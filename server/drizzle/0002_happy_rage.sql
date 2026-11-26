DROP INDEX "idx_chat_sessions_user_id";--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_user_id" ON "chat_sessions" USING btree ("user_id","updated_at" DESC NULLS LAST);