import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Modal, Badge } from '../ui';
import { Plus, Edit2, Copy, Trash2, LayoutTemplate, Calendar } from 'lucide-react';
import './TemplateDashboard.css';

export default function TemplateDashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);

  // Carrega templates do backend
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTemplates(data);
      } else {
        console.error('Erro na API:', data.error || 'Resposta inválida');
        setTemplates([]);
      }
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    navigate(`/editor/${id}`);
  };

  const handleClone = async (id) => {
    try {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) {
        alert('Erro ao buscar o modelo para clonar.');
        return;
      }
      const template = await res.json();

      const payload = {
        nomeTemplate: template.nome + ' - Cópia',
        tipo_documento: template.tipo_documento,
        configuracoes_impressao: template.configuracoes_impressao,
        parametros_esperados: template.parametros_esperados,
        categoria_id: template.categoria_id,
        queries: template.queries,
        elementosCanvas: template.elementosCanvas
      };

      const cloneRes = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (cloneRes.ok) {
        fetchTemplates();
      } else {
        alert('Erro ao criar a cópia do modelo.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de comunicação ao clonar modelo.');
    }
  };

  const confirmDelete = (template) => {
    setTemplateToDelete(template);
    setShowConfirm(true);
  };

  const executeDelete = async () => {
    try {
      const res = await fetch(`/api/templates/${templateToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(templates.filter(t => t.id !== templateToDelete.id));
      } else {
        alert('Erro ao excluir o modelo no servidor.');
      }
    } catch (e) {
      alert('Erro de comunicação.');
    }
    setShowConfirm(false);
    setTemplateToDelete(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              Dashboard de Templates
            </h1>
            <Badge variant="primary">{templates.length} modelos</Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Gerencie e personalize modelos de impressão, etiquetas e relatórios corporativos.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/editor')}
        >
          Novo Modelo
        </Button>
      </div>

      {/* Main Table in Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Modelos Cadastrados</CardTitle>
            <CardDescription>Lista completa de layouts ativos para impressão</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-3.5">Nome do Modelo</th>
                <th className="px-6 py-3.5">Data de Criação</th>
                <th className="px-6 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-12 text-center text-zinc-400">
                    <LayoutTemplate className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nenhum modelo cadastrado ainda. Clique em "Novo Modelo" para criar.
                  </td>
                </tr>
              ) : (
                templates.map(tpl => (
                  <tr key={tpl.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          <LayoutTemplate className="w-4 h-4" />
                        </span>
                        <span>{tpl.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{new Date(tpl.data_criacao).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                          onClick={() => handleEdit(tpl.id)}
                          title="Editar Modelo"
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Copy className="w-3.5 h-3.5" />}
                          onClick={() => handleClone(tpl.id)}
                          title="Duplicar Modelo"
                        >
                          Clonar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                          leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                          onClick={() => confirmDelete(tpl)}
                          title="Excluir Modelo"
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal de Exclusão usando Modal oficial */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirmar Exclusão"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={executeDelete}>
              Sim, Excluir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Você tem certeza que deseja excluir o modelo <strong>{templateToDelete?.nome}</strong>?
          </p>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            Esta ação não pode ser desfeita e removerá todas as configurações de layout e queries associadas.
          </div>
        </div>
      </Modal>
    </div>
  );
}
