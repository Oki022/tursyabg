UPDATE public.promo_products SET name_bg = 'ТОП обява', updated_at = now() WHERE type = 'top';
UPDATE public.promo_products SET name_bg = 'Спешно', updated_at = now() WHERE type = 'urgent';
UPDATE public.promo_products SET name_bg = 'Обнови обявата', updated_at = now() WHERE type = 'bump';