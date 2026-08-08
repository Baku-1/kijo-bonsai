-- list-trees queries trees by wallet_id without a tree_id filter.
-- Without this index the query degrades to a full table scan as the tree
-- count grows. Named index for query-plan debugging, consistent with
-- the idx_trees_token_id pattern in 20260806000001_trees_token_id.sql.
CREATE INDEX IF NOT EXISTS idx_trees_wallet_id
  ON public.trees (wallet_id);

-- Down (reference only -- never run in production):
-- DROP INDEX IF EXISTS idx_trees_wallet_id;
