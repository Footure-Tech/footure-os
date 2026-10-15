import { MdLock, MdPerson } from "react-icons/md";
import { exigirPapel } from "@/lib/auth/session";
import { ROTULO_PERFIL } from "@/lib/auth/perfis";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ds/avatar";
import { CardModulo, LinhaChaveValor } from "@/components/negocio/card-modulo";
import { AvisoAuth } from "@/components/auth/moldura-auth";
import { FormAlterarSenha } from "@/components/perfil/form-alterar-senha";

export default async function PerfilPage() {
  const sessao = await exigirPapel("vendedor", "juridico", "admin");

  return (
    <div className="flex max-w-[1000px] flex-col gap-6">
      <PageHeader modulo="Conta" titulo="Meu perfil" descricao="Seus dados de acesso e a sua senha." />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-start gap-5">
        <CardModulo icone={MdPerson} cor="bg-iconBlue" titulo="Dados da conta">
          <div className="flex items-center gap-3">
            <Avatar nome={sessao.nome} tamanho={48} />
            <div className="flex flex-col">
              <span className="font-bold text-darkPurple1">{sessao.nome}</span>
              <span className="text-sm text-gray">{ROTULO_PERFIL[sessao.papel]}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <LinhaChaveValor rotulo="E-mail" valor={sessao.email} />
            <LinhaChaveValor rotulo="Perfil" valor={ROTULO_PERFIL[sessao.papel]} />
          </div>
        </CardModulo>

        <div id="senha" className="scroll-mt-24">
          <CardModulo icone={MdLock} cor="bg-iconPurple" titulo="Alterar senha">
            {sessao.senhaTemporaria && (
              <AvisoAuth tipo="info">Você está usando a senha temporária enviada por e-mail. Defina uma senha pessoal.</AvisoAuth>
            )}
            <FormAlterarSenha />
          </CardModulo>
        </div>
      </div>
    </div>
  );
}
