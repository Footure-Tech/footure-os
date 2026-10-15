import { MdGroup } from "react-icons/md";
import { createClient } from "@/lib/supabase/server";
import { listarUsuarios } from "@/lib/pedidos/consultas";
import { ROTULO_PERFIL } from "@/lib/auth/perfis";
import { formatarDataCurta } from "@/lib/formatacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ds/avatar";
import { StatusPill } from "@/components/ds/status-pill";
import { EstadoVazio } from "@/components/ds/estado-vazio";
import { UsuarioFormDialog } from "@/components/usuarios/usuario-form-dialog";
import { UsuarioAtivoButton } from "@/components/usuarios/usuario-ativo-button";
import { ReenviarAcessoDialog } from "@/components/usuarios/reenviar-acesso-dialog";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const usuarios = await listarUsuarios(supabase);
  const ativos = usuarios.filter((u) => u.ativo).length;

  return (
    <div className="flex max-w-[1100px] flex-col gap-6">
      <PageHeader
        modulo="Administração"
        titulo="Usuários"
        descricao="Um e-mail com senha temporária é enviado automaticamente para quem for cadastrado aqui."
        acoes={<UsuarioFormDialog modo="criar" />}
      />

      {usuarios.length === 0 ? (
        <div className="rounded-xl border border-gray5 bg-surface shadow-table">
          <EstadoVazio icone={MdGroup} titulo="Nenhum usuário cadastrado" descricao="Use “Adicionar usuário” para dar acesso ao sistema." />
        </div>
      ) : (
        <>
          <span className="-mt-2 text-sm text-gray3">
            {ativos} de {usuarios.length} usuários ativos
          </span>
          <Table minWidth={860}>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar nome={u.nome} tamanho={36} />
                      <div className="flex flex-col">
                        <span className="font-bold text-darkPurple1">{u.nome}</span>
                        <span className="text-xs text-gray3">desde {formatarDataCurta(u.criado_em)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray2">{ROTULO_PERFIL[u.papel]}</TableCell>
                  <TableCell>
                    <StatusPill tom={u.ativo ? "active" : "inactive"}>{u.ativo ? "Ativo" : "Inativo"}</StatusPill>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {u.ativo && <ReenviarAcessoDialog userId={u.user_id} nome={u.nome} />}
                      <UsuarioFormDialog modo="editar" usuario={{ id: u.user_id, nome: u.nome, papel: u.papel }} />
                      <UsuarioAtivoButton userId={u.user_id} ativo={u.ativo} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
