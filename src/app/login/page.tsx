import { FormLogin } from "./form-login";

const AVISOS: Record<string, { tipo: "erro" | "info"; texto: string }> = {
  link_invalido: { tipo: "erro", texto: "O link de redefinição é inválido ou expirou. Peça um novo em “Esqueci minha senha”." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { aviso } = await searchParams;
  return <FormLogin aviso={typeof aviso === "string" ? AVISOS[aviso] : undefined} />;
}
