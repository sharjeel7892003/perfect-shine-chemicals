-- ==============================================================================
-- PERFECT SHINE CHEMICALS — REAL SUPABASE AUTH (auth.users) MIGRATION
-- ==============================================================================
-- 1. Creates all staff accounts in Supabase's official auth.users table
-- 2. Hashes passwords using bcrypt (pgcrypto) — zero plain-text storage
-- 3. Restores foreign key relationship from public.profiles to auth.users(id)
-- 4. Creates an automatic trigger to sync future auth users into public.profiles
-- 5. Enables seamless Forgot Password, Reset Password, and Change Password flows
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- STEP 1: HELPER PROCEDURE TO SAFELY REGISTER AUTH USERS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  staff_rec RECORD;
  v_user_id UUID;
  v_encrypted_pw TEXT;
  
  -- Pre-configured staff accounts for factory management:
  staff_accounts CONSTANT JSONB := '[
    {
      "name": "Sharjeel Ahmad",
      "email": "sharjeel.ahmad41@gmail.com",
      "role": "owner",
      "password": "SharjeelPSC2026!",
      "phone": "0300-8400001"
    },
    {
      "name": "Farhan Sheikh (Accounts & Ledger)",
      "email": "accounts@perfectshine.pk",
      "role": "accounts_staff",
      "password": "PscAccounts2026!",
      "phone": "0333-6700003"
    },
    {
      "name": "Usman Tariq (Sales Lead)",
      "email": "sales@perfectshine.pk",
      "role": "sales_staff",
      "password": "PscSales2026!",
      "phone": "0321-4500002"
    },
    {
      "name": "Aqeel Arshad (Plant Supervisor)",
      "email": "plant@perfectshine.pk",
      "role": "general_staff",
      "password": "PscPlant2026!",
      "phone": "0315-9900004"
    }
  ]'::jsonb;

BEGIN
  FOR staff_rec IN SELECT * FROM jsonb_to_recordset(staff_accounts) AS x(
    name TEXT,
    email TEXT,
    role TEXT,
    password TEXT,
    phone TEXT
  ) LOOP
    -- Compute bcrypt hash for password
    v_encrypted_pw := crypt(staff_rec.password, gen_salt('bf', 10));

    -- Check if user exists in auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(staff_rec.email);

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();

      -- 1. Insert into auth.users (Supabase official authentication service)
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        email_change_token_current,
        phone,
        phone_change,
        phone_change_token,
        reauthentication_token,
        created_at,
        updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        LOWER(TRIM(staff_rec.email)),
        v_encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', staff_rec.name, 'role', staff_rec.role, 'phone', staff_rec.phone),
        false,
        '',
        '',
        '',
        '',
        '',
        COALESCE(staff_rec.phone, ''),
        '',
        '',
        '',
        now(),
        now()
      );

      -- 2. Insert into auth.identities (id is of type UUID)
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', LOWER(TRIM(staff_rec.email))),
        'email',
        LOWER(TRIM(staff_rec.email)),
        now(),
        now(),
        now()
      )
      ON CONFLICT DO NOTHING;

      RAISE NOTICE 'Created auth.users entry for % with ID %', staff_rec.email, v_user_id;
    ELSE
      -- Update existing auth.users password and ensure confirmed & non-null string tokens
      UPDATE auth.users
      SET encrypted_password = v_encrypted_pw,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          raw_user_meta_data = jsonb_build_object('name', staff_rec.name, 'role', staff_rec.role, 'phone', staff_rec.phone),
          confirmation_token = COALESCE(confirmation_token, ''),
          recovery_token = COALESCE(recovery_token, ''),
          email_change_token_new = COALESCE(email_change_token_new, ''),
          email_change = COALESCE(email_change, ''),
          email_change_token_current = COALESCE(email_change_token_current, ''),
          phone_change = COALESCE(phone_change, ''),
          phone_change_token = COALESCE(phone_change_token, ''),
          reauthentication_token = COALESCE(reauthentication_token, ''),
          updated_at = now()
      WHERE id = v_user_id;

      RAISE NOTICE 'Updated existing auth.users password for % (ID %)', staff_rec.email, v_user_id;
    END IF;

    -- 3. Synchronize public.profiles with the exact auth.users ID
    DELETE FROM public.profiles WHERE LOWER(email) = LOWER(staff_rec.email) AND id <> v_user_id;

    INSERT INTO public.profiles (
      id,
      name,
      email,
      role,
      phone,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      staff_rec.name,
      LOWER(TRIM(staff_rec.email)),
      staff_rec.role,
      staff_rec.phone,
      true,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        is_active = true,
        updated_at = now();

  END LOOP;

  -- Heal any existing rows in auth.users that have NULL token strings (GoTrue scanner requirement)
  UPDATE auth.users
  SET confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone = COALESCE(phone, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      reauthentication_token = COALESCE(reauthentication_token, '')
  WHERE confirmation_token IS NULL OR recovery_token IS NULL;

END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: RESTORE FOREIGN KEY RELATIONSHIP FROM profiles TO auth.users
-- ------------------------------------------------------------------------------
-- Delete any orphan profiles not present in auth.users
DELETE FROM public.profiles 
WHERE id NOT IN (SELECT id FROM auth.users);

-- Re-establish the foreign key constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- STEP 3: AUTOMATIC TRIGGER FOR FUTURE USERS
-- ------------------------------------------------------------------------------
-- When a new user is invited or created via Supabase Auth UI or API,
-- automatically insert or update their corresponding public.profiles entry.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    phone,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    LOWER(TRIM(NEW.email)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales_staff'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.profiles.name),
      updated_at = now();
      
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ------------------------------------------------------------------------------
-- STEP 4: PERMISSIONS & RLS ALLOWANCE FOR PROFILES
-- ------------------------------------------------------------------------------
-- Ensure anon & authenticated can read profiles for the login view lookup
GRANT SELECT ON public.profiles TO anon, authenticated;

DROP POLICY IF EXISTS "Allow public read profiles for login" ON public.profiles;
CREATE POLICY "Allow public read profiles for login"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (true);

-- Confirm success
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;
