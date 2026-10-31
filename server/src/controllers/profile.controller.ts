import type { RequestHandler } from 'express';
import * as profileService from '../services/profile.service.js';

export const getMine: RequestHandler = async (req, res) => {
  res.json(await profileService.getMyProfile(req.user!.id));
};

export const updateMine: RequestHandler = async (req, res) => {
  res.json(await profileService.updateMyProfile(req.user!.id, req.body));
};
