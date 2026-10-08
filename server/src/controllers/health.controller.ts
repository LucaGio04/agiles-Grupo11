import type { RequestHandler } from 'express';
import * as healthService from '../services/health.service.js';

export const getHealth: RequestHandler = (_req, res) => {
  res.json(healthService.getHealth());
};
