-- AlterTable: Restricción de formato en el código de permiso (RS-010)
ALTER TABLE "permissions"
ADD CONSTRAINT "permissions_code_format_check"
CHECK (code ~ '^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$');
