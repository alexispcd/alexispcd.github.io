-- Training ne porte plus que la course : zones A, B, C et quatre types.
-- Le renforcement vit dans le module Renfo (tables strength_*). Vérifié avant
-- application : aucune séance en zone ou type renfo, aucun strength_content.

alter table public.training_sessions drop constraint training_sessions_zone_check;
alter table public.training_sessions
  add constraint training_sessions_zone_check check (zone in ('A', 'B', 'C'));

alter table public.training_sessions drop constraint training_sessions_type_check;
alter table public.training_sessions
  add constraint training_sessions_type_check
  check (type in ('facile', 'fractionne', 'tempo', 'sortie_longue'));

alter table public.training_sessions drop column strength_content;
