import type { RequestHandler } from 'express';
import type { ListItemsQuery } from '../schemas/item.schema.js';
import * as itemService from '../services/item.service.js';

export const list: RequestHandler = async (req, res) => {
  // validate ya reemplazó req.query por los filtros parseados (con page y limit por defecto).
  res.json(await itemService.listItems(req.user!.id, req.query as unknown as ListItemsQuery));
};
