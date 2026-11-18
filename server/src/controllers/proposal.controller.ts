import type { RequestHandler } from 'express';
import type { ListProposalsQuery, UpdateProposalInput } from '../schemas/proposal.schema.js';
import * as proposalService from '../services/proposal.service.js';

export const list: RequestHandler = async (req, res) => {
  const { status, type } = req.query as unknown as ListProposalsQuery;
  res.json(await proposalService.listMyProposals(req.user!.id, { status, type }));
};

// PATCH /api/proposals/:id. Despacha según la acción del body.
// - aceptar / rechazar (HU-08) y cancelar (HU-16) responden 200 { data } con la vista del listado.
export const update: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user!.id;
  const { accion } = req.body as UpdateProposalInput;
  switch (accion) {
    case 'aceptar':
    case 'rechazar':
      res.json(await proposalService.respondProposal(userId, id, accion));
      return;
    case 'cancelar':
      res.json({ data: await proposalService.cancelProposal(userId, id) });
      return;
  }
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
