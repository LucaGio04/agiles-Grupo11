import { Router } from 'express';
import * as proposalController from '../controllers/proposal.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import {
  listProposalsQuerySchema,
  proposalIdParamsSchema,
  respondProposalSchema,
} from '../schemas/proposal.schema.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  validate({ query: listProposalsQuerySchema }),
  proposalController.list
);

router.patch(
  '/:id',
  requireAuth,
  validate({ params: proposalIdParamsSchema, body: respondProposalSchema }),
  proposalController.respond
);

export default router;
