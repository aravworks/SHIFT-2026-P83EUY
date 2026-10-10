-- Mesh node IDs are anonymous and rotating, and alerts can arrive from nodes that were never
-- provisioned (or were provisioned on another device). A foreign key to riders rejects those alerts.
-- Idempotent: safe if the constraint is already gone.
alter table alerts drop constraint if exists alerts_origin_node_fkey;
