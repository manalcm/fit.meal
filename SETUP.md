# Configurar fitmeal (paso a paso, sin necesidad de saber programar)

Esto conecta la app a tu propia base de datos gratuita en Supabase, donde se guardarán los ingredientes, platos, plan y objetivos de los dos.

## 1. Crear la cuenta y el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita (puedes entrar con tu cuenta de Google).
2. Pulsa **New project**.
3. Rellena:
   - **Name**: `fitmeal` (o el nombre que quieras).
   - **Database Password**: genera una y guárdala en un lugar seguro (no la necesitarás para esta app, pero consérvala).
   - **Region**: elige la más cercana a España, por ejemplo `West EU (Ireland)` o `Central EU (Frankfurt)`.
4. Pulsa **Create new project** y espera 1-2 minutos mientras Supabase lo prepara.

## 2. Crear las tablas (pegar el SQL)

1. En el menú de la izquierda de tu proyecto, entra en **SQL Editor**.
2. Pulsa **New query**.
3. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este proyecto, copia **todo** su contenido, y pégalo en el editor de Supabase.
4. Pulsa **Run** (o Ctrl+Enter). Debería decir "Success. No rows returned".
5. Comprueba que se crearon las tablas: en el menú de la izquierda entra en **Table Editor** y deberías ver `ingredients`, `meals`, `meal_ingredients`, `people` y `plan_entries`, con `people` ya con 2 filas ("Persona 1" y "Persona 2").

> Más adelante, en la pantalla de Ajustes de la app, podréis cambiar los nombres, colores y objetivos de las 2 personas sin tocar la base de datos directamente.

## 3. Copiar las 2 claves y pegarlas en el proyecto

1. En el menú de la izquierda, entra en **Project Settings** (icono de engranaje) → **Data API** (o **API** según la versión).
2. Ahí verás dos valores que necesitas:
   - **Project URL** (algo como `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public key** (una clave larga de letras y números)
3. En la carpeta del proyecto (`Nutricion`), busca el archivo `.env.example` y haz una copia con el nombre exacto `.env` (sin ".example").
   - En Windows: copia el archivo, pégalo en la misma carpeta, y renombra la copia a `.env`.
4. Abre `.env` con el Bloc de notas y sustituye los valores:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=la-clave-anon-que-copiaste
   ```

5. Guarda el archivo. **No compartas ni subas este archivo a internet** — son las llaves de tu base de datos.

## 4. Arrancar la app en tu ordenador

Abre una terminal en la carpeta del proyecto y ejecuta:

```
npm install
npm run dev
```

Se abrirá una dirección como `http://localhost:5173`. Ábrela en el navegador: si todo está bien configurado, verás "✓ Conectado. Personas encontradas: Persona 1, Persona 2".

Si ves un mensaje de error en rojo, casi siempre es porque:
- El archivo se llama `.env.example` en vez de `.env`, o
- La URL o la clave tienen un espacio o carácter de más, o
- Falta ejecutar el SQL del paso 2.

## 5. Activar el login por email (magic link)

Esto ya viene activado por defecto en Supabase para nuevos proyectos (Authentication → Providers → Email). Lo conectaremos a la pantalla de la app en una fase posterior; por ahora no necesitas hacer nada más aquí.

---

Cuando tengas el mensaje de "✓ Conectado" en el navegador, avisa y seguimos con la Fase 2 (ingredientes).
