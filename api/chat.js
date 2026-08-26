import "dotenv/config";
import { handleChat } from "../src/handlers/chat.js";
import { withJsonBody } from "../src/handlers/vercel.js";

export default withJsonBody(handleChat);
