DO $$
DECLARE
    i INT;
    dt DATE := '2023-01-01';
BEGIN
    INSERT INTO upload_records (id, filename, entity_type, row_count, warning_count, error_count, status, created_at)
    VALUES ('00000000-0000-0000-0000-000000000000', 'dummy', 'sales', 35, 0, 0, 'completed', NOW())
    ON CONFLICT DO NOTHING;

    FOR i IN 1..35 LOOP
        INSERT INTO sales (id, sale_date, quantity, unit_price, total_amount, upload_id, created_at)
        VALUES (gen_random_uuid(), dt, 1, 10.0, 10.0, '00000000-0000-0000-0000-000000000000', NOW());
        dt := dt + INTERVAL '1 day';
    END LOOP;
END $$;
