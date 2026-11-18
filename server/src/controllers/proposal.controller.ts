import type { RequestHandler } from 'express';
import type { ListProposalsQuery, RespondProposalBody } from '../schemas/proposal.schema.js';
import * as proposalService from '../services/proposal.service.js';

export const list: RequestHandler = async (req, res) => {
  const { status, type } = req.query as unknown as ListProposalsQuery;
  res.json(await proposalService.listMyProposals(req.user!.id, { status, type }));
};

export const respond: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const { accion } = req.body as RespondProposalBody;
  res.json(await proposalService.respondProposal(req.user!.id, id, accion));
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
