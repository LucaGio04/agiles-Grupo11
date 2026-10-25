import type { RequestHandler } from 'express';
import * as itemService from '../services/item.service.js';

export const create: RequestHandler = async (req, res) => {
  res.status(201).json({ item: await itemService.createItem(req.user!.id, req.body) });
};
