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

// NOWA FUNKCJA: Pobieranie statystyk statusów
export async function getDecisionStatsAction() {
  try {
    const stats = await prisma.decision.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    // Obliczenie totalu
    const total = await prisma.decision.count();

    // Formatowanie wyników
    const formattedStats = {
      total,
      new: stats.find(s => s.status === 'new')?._count.status || 0,
      in_progress: stats.find(s => s.status === 'in_progress')?._count.status || 0,
      pending: stats.find(s => s.status === 'pending')?._count.status || 0,
      closed: stats.find(s => s.status === 'closed')?._count.status || 0,
    };

    return { success: true, data: formattedStats };
  } catch (error) {
    console.error("Błąd pobierania statystyk:", error);
    return {
      success: false,
      data: { total: 0, new: 0, in_progress: 0, pending: 0, closed: 0 }
    };
  }
}