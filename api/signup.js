const SUPABASE_URL = process.env.SUPABASE_URL || "https://fpxazuvyphdrlsqfhsai.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const jsonHeaders = { "Content-Type": "application/json" };

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Metodo no permitido." });
  }

  if (!SERVICE_ROLE_KEY) {
    return response.status(500).json({
      error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.",
    });
  }

  const { email, password } = request.body ?? {};
  const firstName = normalizeName(request.body?.firstName);
  const lastName = normalizeName(request.body?.lastName);
  if (!isValidEmail(email) || !password || !firstName || !lastName) {
    return response.status(400).json({ error: "Ingresa nombre, apellido, correo valido y contrasena." });
  }

  try {
    const supabaseResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        ...jsonHeaders,
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
        },
      }),
    });

    const result = await supabaseResponse.json().catch(() => ({}));
    if (!supabaseResponse.ok) {
      return response.status(statusForSupabaseError(result)).json({
        error: getSignupErrorMessage(result),
      });
    }

    return response.status(201).json({ ok: true });
  } catch (error) {
    return response.status(502).json({
      error: `No se pudo conectar con Supabase: ${error.message}`,
    });
  }
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function statusForSupabaseError(result) {
  const message = String(result.msg || result.message || result.error || "").toLowerCase();
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) return 409;
  if (message.includes("password") || message.includes("email")) return 400;
  return 502;
}

function getSignupErrorMessage(result) {
  const rawMessage = String(result.msg || result.message || result.error || "");
  const message = rawMessage.toLowerCase();

  if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
    return "Ya existe una cuenta con ese correo. Inicia sesion con ese mail y contrasena.";
  }

  if (message.includes("password")) {
    return "Supabase no acepto esa contrasena. Elegi otra y volve a intentar.";
  }

  if (message.includes("email")) {
    return "Ingresa un correo electronico valido.";
  }

  return rawMessage || "No se pudo crear la cuenta.";
}
