"use server"

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getDecisionsAction() {
  try {
    // Pobieramy wszystkie rekordy, sortując od najnowszych
    const decisions = await prisma.decision.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return { success: true, data: decisions };
  } catch (error) {
    console.error("Błąd pobierania spraw:", error);
    return { success: false, data: [] };
  }
}