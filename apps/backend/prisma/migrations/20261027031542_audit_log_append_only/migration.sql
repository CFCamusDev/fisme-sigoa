-- Migración 2: Rol sigoa_app y política append-only para audit_logs (RS-040, RNF-014)

-- 1. Crear el rol de grupo 'sigoa_app' si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sigoa_app') THEN
        CREATE ROLE sigoa_app NOLOGIN;
    END IF;
END $$;

-- 2. Permisos sobre el esquema public
GRANT USAGE ON SCHEMA public TO sigoa_app;

-- 3. Permisos explícitos sobre la tabla audit_logs: solo SELECT e INSERT
GRANT SELECT, INSERT ON TABLE "audit_logs" TO sigoa_app;

-- 4. Revocar todo acceso público/por defecto a la tabla audit_logs
REVOKE ALL ON TABLE "audit_logs" FROM PUBLIC;

-- 5. Revocar explícitamente cualquier permiso de UPDATE, DELETE y TRUNCATE para sigoa_app
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_logs" FROM sigoa_app;

-- 6. Configurar privilegios por defecto para tablas y secuencias futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sigoa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sigoa_app;

-- Reversible / Down migration:
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM sigoa_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM sigoa_app;
-- REVOKE ALL ON TABLE "audit_logs" FROM sigoa_app;
-- REVOKE USAGE ON SCHEMA public FROM sigoa_app;
-- DROP ROLE IF EXISTS sigoa_app;
