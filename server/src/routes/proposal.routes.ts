import { Router } from 'express';
import * as proposalController from '../controllers/proposal.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import {
  listProposalsQuerySchema,
  proposalIdParamsSchema,
  updateProposalSchema,
} from '../schemas/proposal.schema.js';
import { createRatingSchema } from '../schemas/rating.schema.js';

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
  validate({ params: proposalIdParamsSchema, body: updateProposalSchema }),
  proposalController.update
);

router.post(
  '/:id/rate',
  requireAuth,
  validate({ params: proposalIdParamsSchema, body: createRatingSchema }),
  proposalController.rate
);

export default router;
