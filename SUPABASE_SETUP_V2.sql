-- Actualización V2: Tablas para gestionar Orígenes y Categorías de Productos

CREATE TABLE IF NOT EXISTS origins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas RLS (Row Level Security)
ALTER TABLE origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Permitir acceso total a usuarios autenticados
CREATE POLICY "Auth users origins access" ON origins FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users categories access" ON categories FOR ALL USING (auth.role() = 'authenticated');

-- Insertar algunos valores por defecto para Orígenes
INSERT INTO origins (name, code)
VALUES 
    ('CHINA', 'CN'),
    ('USA / MIAMI', 'US'),
    ('PAKISTAN', 'PK'),
    ('ESPAÑA', 'ES'),
    ('REINO UNIDO', 'UK'),
    ('ALEMANIA', 'DE')
ON CONFLICT (name) DO NOTHING;

-- Insertar algunos valores por defecto para Categorías
INSERT INTO categories (name, description)
VALUES 
    ('ROPA', 'Indumentaria general'),
    ('ELECTRÓNICA', 'Equipos, celulares, computadoras'),
    ('ACCESORIOS', 'Joyas, adornos, etc.'),
    ('SUPLEMENTOS', 'Vitaminas, proteínas'),
    ('JUGUETES', 'Juguetes y pasatiempos'),
    ('CALZADO', 'Zapatos, zapatillas')
ON CONFLICT (name) DO NOTHING;
