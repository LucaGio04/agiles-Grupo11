import type { RequestHandler } from 'express';
import type { ListProposalsQuery } from '../schemas/proposal.schema.js';
import * as proposalService from '../services/proposal.service.js';

export const list: RequestHandler = async (req, res) => {
  const { status } = req.query as unknown as ListProposalsQuery;
  res.json(await proposalService.listMyProposals(req.user!.id, status));
};
