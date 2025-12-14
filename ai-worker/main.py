from fastapi import FastAPI, UploadFile, File, HTTPException
from paddleocr import PaddleOCR
from pdf2image import convert_from_bytes
from PIL import Image
import io
import numpy as np
import cv2
import uvicorn
import paddle

app = FastAPI()

print("⏳ Konfiguracja urządzenia...")
try:
    paddle.device.set_device('gpu')
    print(f"✅ Ustawiono urządzenie: {paddle.device.get_device()}")
except Exception as e:
    print(f"⚠️ Nie udało się ustawić GPU, używam CPU. Błąd: {e}")
    paddle.device.set_device('cpu')

print("⏳ Inicjalizacja modelu PaddleOCR...")

# ZOPTYMALIZOWANA konfiguracja dla GPU
ocr = PaddleOCR(
    lang='pl',
    use_angle_cls=True,
    use_textline_orientation=False,
    show_log=False,
    det_db_thresh=0.3,
    det_db_box_thresh=0.5,
    rec_batch_num=50,  # ZWIĘKSZONE z 6 do 50 - GPU dostanie więcej pracy
    use_gpu=True,  # Wymuś GPU
    gpu_mem=6000,  # 6GB pamięci GPU (RTX 4050 ma 6GB)
    enable_mkldnn=False,  # Wyłącz CPU optimization
)

print("✅ Model gotowy!")


@app.get("/")
def health_check():
    return {
        "status": "online",
        "engine": "PaddleOCR",
        "device_used": paddle.device.get_device()
    }


@app.post("/ocr")
async def ocr_process(file: UploadFile = File(...)):
    # NOWA walidacja
    allowed_types = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Niedozwolony typ pliku. Akceptowane: PDF, PNG, JPG, DOC, DOCX"
        )

    try:
        contents = await file.read()
        full_text = ""

        # PDF - konwersja na obrazy
        if file.content_type == "application/pdf":
            images = convert_from_bytes(
                contents,
                dpi=300,
                poppler_path=r"D:\Pobrane\Release-25.12.0-0\poppler-25.12.0\Library\bin"
            )

        # PNG/JPG - bezpośrednio
        elif file.content_type in ["image/png", "image/jpeg", "image/jpg"]:
            img = Image.open(io.BytesIO(contents))
            images = [img]

        # DOC/DOCX - wymagana dodatkowa biblioteka
        elif file.content_type in ["application/msword",
                                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
            raise HTTPException(
                status_code=501,
                detail="DOC/DOCX nie jest jeszcze obsługiwany - tylko PDF i obrazy"
            )

        # OCR dla wszystkich obrazów
        print(f"🔄 Przetwarzanie {len(images)} stron...")

        for i, img in enumerate(images):
            print(f"  📄 Strona {i + 1}/{len(images)}")

            img_np = np.array(img)
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

            result = ocr.ocr(img_np, cls=True)

            page_text = ""
            if result and result[0]:
                lines = [line[1][0] for line in result[0]]
                page_text = "\n".join(lines)

            full_text += f"\n--- Strona {i + 1} ---\n{page_text}"

        print("✅ OCR zakończone!")

        return {
            "filename": file.filename,
            "text": full_text
        }

    except Exception as e:
        print(f"❌ Błąd: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)