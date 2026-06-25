-- Ajout des colonnes pour le suivi de génération asynchrone
alter table training_plans
  add column if not exists generation_status text not null default 'ready',
  add column if not exists generation_error text;
