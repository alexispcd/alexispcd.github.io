-- Progression de revision en repetition espacee (Leitner 5 boites).
-- Le contenu des cartes vit dans le bundle front, jamais en base.
-- Absence de ligne = carte neuve, boite 1, due immediatement.
create table revision_progress (
  user_id          uuid not null references auth.users on delete cascade,
  card_id          text not null,
  theme_id         text not null,
  box              smallint not null default 1 check (box between 1 and 5),
  due_on           date not null default current_date,
  last_reviewed_at timestamptz,
  primary key (user_id, card_id)
);

alter table revision_progress enable row level security;
create policy "user gere ses revisions" on revision_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on revision_progress to authenticated;
