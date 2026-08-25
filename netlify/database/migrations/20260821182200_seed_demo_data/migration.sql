-- Demo accounts (password for both: password123) and one demo room, so the
-- app is usable immediately after the first deploy.
INSERT INTO "users" ("name", "email", "password_hash", "role") VALUES
  ('Admin Alex', 'admin@example.com', 'e07252f6e9a141decb5292c1a3c48b8e:8860007fdf882ecf3123bd64a9c105307a056865835231d8c89c0afd049e8c0c31b39b53cd75ac8ad6bef287ad8f20804746fbc1cf4f84266d618e7ced38ada3', 'admin'),
  ('Employee Emma', 'employee@example.com', 'c7a5a788a995b5b94b8eb4adfcec3703:ae2aeec944100f635852d02437d8e803093e6798b7b3d57ba7e09f09ef94c6e3bd969252ef5d9121775f42196ba8557b341005f5f2f6dbb4e4dcb72a48ee0776', 'employee');

INSERT INTO "rooms" ("name", "location", "floor", "capacity", "equipment") VALUES
  ('Falcon', 'HQ - Downtown', '3rd Floor', 8, ARRAY['Projector', 'Video Conferencing', 'Whiteboard']);
