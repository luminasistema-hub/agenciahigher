CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id     UUID;
  v_prefix TEXT;
  v_num    INTEGER;
  v_year   TEXT;
  v_result TEXT;
BEGIN
  -- Seleciona também o ID para poder usar no WHERE do UPDATE
  SELECT id, invoice_prefix, next_invoice_number
  INTO v_id, v_prefix, v_num
  FROM public.financial_settings
  LIMIT 1;

  v_year   := TO_CHAR(NOW(), 'YYYY');
  v_result := v_prefix || '-' || v_year || '-' || LPAD(v_num::TEXT, 4, '0');

  -- O UPDATE agora tem WHERE para acalmar as políticas de segurança do banco
  UPDATE public.financial_settings
  SET next_invoice_number = next_invoice_number + 1
  WHERE id = v_id;

  RETURN v_result;
END;
$$;
