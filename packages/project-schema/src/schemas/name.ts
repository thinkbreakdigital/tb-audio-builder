import { z } from 'zod';

/** Display names remain exactly as entered; only validation trims for blankness. */
export const ProjectOrChannelNameSchema = z
	.string()
	.max(120)
	.refine((value) => value.trim().length > 0, { message: 'name must not be blank' });
