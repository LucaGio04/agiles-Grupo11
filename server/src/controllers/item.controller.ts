import type { RequestHandler } from 'express';
import type { ListItemsQuery } from '../schemas/item.schema.js';
import * as itemService from '../services/item.service.js';

export const create: RequestHandler = async (req, res) => {
  res.status(201).json({ item: await itemService.createItem(req.user!.id, req.body) });
};

export const getById: RequestHandler = async (req, res) => {
  res.json(await itemService.getItemById(Number(req.params.id)));
};

export const list: RequestHandler = async (req, res) => {
  // validate ya reemplazó req.query por los filtros parseados (con page y limit por defecto).
  res.json(await itemService.listItems(req.user!.id, req.query as unknown as ListItemsQuery));
};

// Edita una publicación propia (HU-14).
export const update: RequestHandler = async (req, res) => {
  const item = await itemService.updateItem(Number(req.params.id), req.user!.id, req.body);
  res.json({ item });
};
