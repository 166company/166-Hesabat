import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { reportQueries } from '../db/database';

const router = Router();
router.use(authMiddleware);

// Dashboard summary — Finance Table-dakı saxlanmış datadan götürür (anında, API çağırmır)
router.get('/summary', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const sections = await reportQueries.getSections(userId);
    const allRows = await Promise.all(sections.map(async (sec: any) => {
      const rows = await reportQueries.getRows(sec.id);
      const cells = await reportQueries.getCells(sec.id);
      const cellMap: Record<string, number> = {};
      cells.forEach((c: any) => { cellMap[`${c.row_id}:${c.col_key}`] = c.value; });
      return rows.map((r: any) => ({ id: r.id, cells: cellMap, rowId: r.id }));
    }));

    const flat = allRows.flat();
    const gKeys = ['search', 'display', 'video', 'pmax'];
    const google = flat.reduce((s: number, r: any) =>
      s + gKeys.reduce((a: number, k: string) => a + (r.cells[`${r.rowId}:${k}`] || 0), 0), 0);
    const meta   = flat.reduce((s: number, r: any) => s + (r.cells[`${r.rowId}:meta`] || 0), 0);
    const tiktok = flat.reduce((s: number, r: any) => s + (r.cells[`${r.rowId}:tiktok`] || 0), 0);
    const total  = google + meta + tiktok;

    res.json({
      google: Math.round(google * 100) / 100,
      meta:   Math.round(meta * 100) / 100,
      tiktok: Math.round(tiktok * 100) / 100,
      total:  Math.round(total * 100) / 100,
    });
  } catch {
    res.json({ google: 0, meta: 0, tiktok: 0, total: 0 });
  }
});

export default router;
