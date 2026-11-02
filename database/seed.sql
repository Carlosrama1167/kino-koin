-- Katalog layanan yang sudah dikonfirmasi pada PRD. Jalankan setelah schema.sql.
BEGIN;
INSERT INTO services(code,name,category,pricing_unit,base_price) VALUES
 ('SELF-CUCI','Cuci','Self Service','siklus',7000),
 ('SELF-KERING','Kering','Self Service','siklus',10000),
 ('SELF-CUCI-KERING','Cuci + Kering','Self Service','siklus',16000),
 ('SELF-SPIN','Extra Spin','Self Service','siklus',4000),
 ('SELF-EXTRA-DRY','Extra Dry','Self Service','siklus',5000),
 ('DROP-CUCI-KERING','Cuci + Kering','Drop Off','muatan',20000),
 ('DROP-KERING','Kering saja','Drop Off','7kg',12000),
 ('DROP-LIPAT','Lipat Pakaian','Drop Off','kg',1500),
 ('CKS-REG','Reguler','Cuci Kering Setrika','kg',6000),
 ('CKS-EXP','Express','Cuci Kering Setrika','kg',8000),
 ('CKS-KILAT','Kilat','Cuci Kering Setrika','kg',10000),
 ('SET-REG','Setrika Reguler','Setrika Saja','kg',4000),
 ('SET-EXP','Setrika Express','Setrika Saja','kg',6000)
ON CONFLICT(code) DO NOTHING;
INSERT INTO membership_types(code,name,card_color,stamp_slots,requires_verification) VALUES
 ('REGULAR','Member Reguler','green',12,FALSE),
 ('STUDENT','Member Pelajar/Mahasiswa','yellow',6,TRUE)
ON CONFLICT(code) DO NOTHING;
INSERT INTO service_prices(service_id,price_type,price,start_time,end_time)
SELECT id,'malam',14000,'23:00','06:00' FROM services WHERE code='SELF-CUCI-KERING'
ON CONFLICT(service_id,price_type) DO NOTHING;
INSERT INTO service_prices(service_id,price_type,price,start_time,end_time)
SELECT id,'malam',18000,'23:00','06:00' FROM services WHERE code='DROP-CUCI-KERING'
ON CONFLICT(service_id,price_type) DO NOTHING;
COMMIT;
