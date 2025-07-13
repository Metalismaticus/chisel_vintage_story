import { config } from 'dotenv';
config();

// Schemas need to be imported before the flows that use them.
import '@/ai/flows/schemas';
import '@/ai/flows/image-to-schematic';
import '@/ai/flows/text-to-schematic';
import '@/ai/flows/shape-to-schematic';
