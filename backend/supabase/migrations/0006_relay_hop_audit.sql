-- Forensic relay log: who handed the packet to this node, and whether this node's tag check passed.
alter table relay_hops add column if not exists prev_node int;
alter table relay_hops add column if not exists tag_valid boolean;
