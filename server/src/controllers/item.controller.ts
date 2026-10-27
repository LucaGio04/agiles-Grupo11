import type { RequestHandler } from 'express';
import * as itemService from '../services/item.service.js';

export const create: RequestHandler = async (req, res) => {
  res.status(201).json({ item: await itemService.createItem(req.user!.id, req.body) });
};

export const getById: RequestHandler = async (req, res) => {
  res.json(await itemService.getItemById(Number(req.params.id)));
};
