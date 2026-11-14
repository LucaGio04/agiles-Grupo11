import type { RequestHandler } from 'express';
import type { ListProposalsQuery } from '../schemas/proposal.schema.js';
import * as proposalService from '../services/proposal.service.js';

export const list: RequestHandler = async (req, res) => {
  const { status } = req.query as unknown as ListProposalsQuery;
  res.json(await proposalService.listMyProposals(req.user!.id, status));
};

// Propone un intercambio sobre el ítem :id (HU-06). Responde 201 con la propuesta PENDIENTE.
export const propose: RequestHandler = async (req, res) => {
  const proposal = await proposalService.createProposal(
    req.user!.id,
    Number(req.params.id),
    req.body
  );
  res.status(201).json({ proposal });
};
