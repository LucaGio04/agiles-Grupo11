import type { RequestHandler } from 'express';
import type { ListMyItemsQuery } from '../schemas/user.schema.js';
import * as userService from '../services/user.service.js';

export const listMyItems: RequestHandler = async (req, res) => {
  const { status } = req.query as unknown as ListMyItemsQuery;
  res.json(await userService.listMyItems(req.user!.id, status));
};
