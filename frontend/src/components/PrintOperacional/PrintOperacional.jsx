import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal, Input, Badge } from '../ui';
import { Printer, Filter, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PrintOperacional() {
  const { userProfile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [templateSelecionado, setTemplateSelecionado] = useState('');
  const [camposDinamicos, setCamposDinamicos] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  
  const [documentoGerado, setDocumentoGerado] = useState(null);
  
  // States para o Modal de Input Manual
  const [pendingDocument, setPendingDocument] = useState(null);
  const [manualInputs, setManualInputs] = useState({});

  // 1. Carrega os templates e categorias disponíveis ao abrir a tela
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resTemplates, resCategorias] = await Promise.all([
          fetch('/api/templates'),
          fetch('/api/categorias')
        ]);
        if (resTemplates.ok) setTemplates(await resTemplates.json());
        if (resCategorias.ok) {
          const allCats = await resCategorias.json();
          // Filtra categorias baseado no perfil do usuário
          if (userProfile?.isAdmin || userProfile?.categorias_modelos === 'todas') {
            setCategorias(allCats);
          } else {
            const allowedIds = userProfile?.categorias_modelos || [];
            setCategorias(allCats.filter(c => allowedIds.includes(c.id)));
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      }
    };
    if (userProfile) {
      fetchData();
    }
  }, [userProfile]);

  // Filtra templates para exibir apenas os que pertencem às categorias permitidas
  const templatesPermitidos = templates.filter(t => {
    if (userProfile?.isAdmin || userProfile?.categorias_modelos === 'todas') return true;
    const allowedIds = userProfile?.categorias_modelos || [];
    return allowedIds.includes(t.categoria_id);
  });

  const templatesFiltrados = categoriaSelecionada 
    ? templatesPermitidos.filter(t => t.categoria_id === categoriaSelecionada)
    : templatesPermitidos;

  // 2. Ao selecionar um template, busca os campos_input vinculados a ele
  useEffect(() => {
    if (!templateSelecionado) {
      setCamposDinamicos([]);
      setFormData({});
      return;
    }

    const t = templates.find(x => x.id === templateSelecionado);
    const parametros = t?.parametros_esperados || [];
    setCamposDinamicos(parametros);
    
    // Reseta o formulário
    const initialData = {};
    parametros.forEach(c => initialData[c.nome_campo] = '');
    setFormData(initialData);
    setDocumentoGerado(null);
    setPendingDocument(null);
  }, [templateSelecionado, templates]);

  // Handle mudança nos inputs gerados dinamicamente
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleManualInputChange = (id, value) => {
    setManualInputs(prev => ({ ...prev, [id]: value }));
  };

  const formatarMascara = (value, tipoMascara) => {
    if (!value || !value.trim()) return value;
    let newValue = value;
    if (tipoMascara === 'financeiro') {
      newValue = newValue.replace(/[^\d,.-]/g, '');
      if (!newValue.includes(',')) {
        newValue = newValue + ',00';
      } else {
        const parts = newValue.split(',');
        if (parts[1].length === 1) newValue = parts[0] + ',' + parts[1] + '0';
        else if (parts[1].length > 2) newValue = parts[0] + ',' + parts[1].substring(0, 2);
      }
      if (!newValue.startsWith('R$')) {
        newValue = 'R$ ' + newValue;
      }
    } else if (tipoMascara === 'caixa_alta') {
      newValue = newValue.toUpperCase();
    } else if (tipoMascara === 'inteiro') {
      newValue = newValue.replace(/\D/g, '');
    } else if (tipoMascara === 'data') {
      const numbers = newValue.replace(/\D/g, '');
      if (numbers.length <= 2) newValue = numbers;
      else if (numbers.length <= 4) newValue = `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
      else newValue = `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
    }
    return newValue;
  };

  const handleManualInputBlur = (el) => {
    if (el.mascara_dados && manualInputs[el.id]) {
      const formatted = formatarMascara(manualInputs[el.id], el.mascara_dados);
      if (formatted !== manualInputs[el.id]) {
        setManualInputs(prev => ({ ...prev, [el.id]: formatted }));
      }
    }
  };

  // Disparo da API de Resolução
  const handleImprimir = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDocumentoGerado(null);
    setPendingDocument(null);

    try {
      const response = await fetch('/api/resolve-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateSelecionado,
          parametros: formData,
          user_id: userProfile?.id || null
        })
      });

      if (!response.ok) {
        const err = await response.json();
        alert(`Erro ao resolver documento: ${err.error || 'Falha desconhecida'}`);
        return;
      }

      const docResolvido = await response.json();
      
      const elementosParaPreencher = docResolvido.elementos_finais.filter(el => el.precisa_input_manual);
      
      if (elementosParaPreencher.length > 0) {
        const initialManual = {};
        elementosParaPreencher.forEach(el => {
          initialManual[el.id] = el.valor_resolvido || '';
        });
        setManualInputs(initialManual);
        setPendingDocument(docResolvido);
      } else {
        setDocumentoGerado(docResolvido);
        dispararImpressaoZebra(docResolvido);
      }

    } catch (error) {
      console.error('Falha de rede ao imprimir:', error);
      alert('Erro de conexão com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmarInputManual = (e) => {
    e.preventDefault();
    if (!pendingDocument) return;

    const docAtualizado = JSON.parse(JSON.stringify(pendingDocument));
    docAtualizado.elementos_finais.forEach(el => {
      if (el.precisa_input_manual && manualInputs[el.id] !== undefined) {
        el.valor_resolvido = manualInputs[el.id];
        delete el.precisa_input_manual;
      }
    });

    setPendingDocument(null);
    setDocumentoGerado(docAtualizado);
    dispararImpressaoZebra(docAtualizado);
  };

  const dispararImpressaoZebra = (documento) => {
    const { tipo_impressao, raw_code } = documento;

    if (tipo_impressao === 'ZPL') {
      if (window.ZebraBrowserPrint) {
        console.log('Enviando ZPL via Zebra Browser Print SDK...');
      } else {
        console.log('--- COMANDO ZPL GERADO ---');
        console.log(raw_code);
        alert('Etiqueta ZPL pronta para envio! (Verifique o console para inspecionar o raw_code)');
      }
    } else {
      gerarVisualizacaoPDF(documento);
    }
  };

  const gerarVisualizacaoPDF = (documento) => {
    try {
      const { template, elementos_finais } = documento;
      const largura = template?.largura_mm || 100;
      const altura = template?.altura_mm || 150;
      const orientacao = largura > altura ? 'landscape' : 'portrait';

      const doc = new jsPDF({
        orientation: orientacao,
        unit: 'px',
        format: [largura * 3.7795, altura * 3.7795],
        hotfixes: ['px_scaling']
      });

      elementos_finais.forEach((el) => {
        const x = el.posicao_x || 0;
        const y = el.posicao_y || 0;

        if (el.tipo_elemento === 'texto') {
          doc.setFont('Helvetica', el.estilo_fonte === 'bold' ? 'bold' : 'normal');
          doc.setFontSize(el.tamanho_fonte || 12);
          doc.setTextColor(el.cor || '#000000');
          
          let textoParaExibir = el.valor_resolvido || '';
          if (el.mascara_dados) {
            textoParaExibir = formatarMascara(textoParaExibir, el.mascara_dados);
          }
          
          const maxW = el.largura ? el.largura : (largura * 3.7795 - x);
          const splitLines = doc.splitTextToSize(textoParaExibir, maxW);
          const lineHeight = (el.tamanho_fonte || 12) * 1.15;

          if (el.alinhamento === 'center') {
            const centerX = x + (el.largura ? el.largura / 2 : 0);
            doc.text(splitLines, centerX, y + (el.tamanho_fonte || 12), { align: 'center' });
          } else if (el.alinhamento === 'right') {
            const rightX = x + (el.largura ? el.largura : 0);
            doc.text(splitLines, rightX, y + (el.tamanho_fonte || 12), { align: 'right' });
          } else {
            doc.text(splitLines, x, y + (el.tamanho_fonte || 12));
          }
        }
        else if (el.tipo_elemento === 'caixa') {
          const corBorda = el.cor_borda || '#000000';
          const corFundo = el.cor_fundo || 'transparent';
          
          const isBorderTransparent = corBorda === 'transparent';
          const isBgTransparent = corFundo === 'transparent';
          
          if (isBorderTransparent && isBgTransparent) {
            return;
          }

          if (el.altura < 4) {
             if (!isBgTransparent) {
               doc.setFillColor(corFundo);
               doc.rect(x, y, el.largura || 100, el.altura || 2, 'F');
             } else if (!isBorderTransparent) {
               doc.setFillColor(corBorda);
               doc.rect(x, y, el.largura || 100, el.altura || 2, 'F');
             }
          } else {
            if (!isBorderTransparent && !isBgTransparent) {
              doc.setDrawColor(corBorda);
              doc.setLineWidth(el.espessura_borda || 1);
              doc.setFillColor(corFundo);
              doc.rect(x, y, el.largura || 100, el.altura || 50, 'FD');
            } else if (!isBorderTransparent) {
              doc.setDrawColor(corBorda);
              doc.setLineWidth(el.espessura_borda || 1);
              doc.rect(x, y, el.largura || 100, el.altura || 50, 'D');
            } else if (!isBgTransparent) {
              doc.setFillColor(corFundo);
              doc.rect(x, y, el.largura || 100, el.altura || 50, 'F');
            }
          }
        }
        else if (el.tipo_elemento === 'linha') {
          const corBorda = el.cor_borda || '#000000';
          if (corBorda === 'transparent') {
            return;
          }
          doc.setFillColor(corBorda);
          doc.rect(x, y, el.largura || 100, el.altura || 2, 'F');
        }
        else if (el.tipo_elemento === 'imagem') {
          if (el.url_imagem) {
            try {
              let format = 'JPEG';
              if (el.url_imagem.startsWith('data:image/png')) format = 'PNG';
              else if (el.url_imagem.startsWith('data:image/webp')) format = 'WEBP';
              
              const imgProps = doc.getImageProperties(el.url_imagem);
              const naturalRatio = imgProps.width / imgProps.height;
              
              const boxWidth = el.largura || 100;
              const boxHeight = el.altura || 100;
              const boxRatio = boxWidth / boxHeight;
              
              let drawWidth = boxWidth;
              let drawHeight = boxHeight;
              let drawX = x;
              let drawY = y;
              
              if (naturalRatio > boxRatio) {
                drawHeight = boxWidth / naturalRatio;
                drawY = y + (boxHeight - drawHeight) / 2;
              } else {
                drawWidth = boxHeight * naturalRatio;
                drawX = x + (boxWidth - drawWidth) / 2;
              }
              
              doc.addImage(el.url_imagem, format, drawX, drawY, drawWidth, drawHeight);
            } catch (err) {
              console.error('Erro ao adicionar imagem ao PDF:', err);
            }
          }
        }
        else if (el.tipo_elemento === 'codigo_barras') {
          doc.setFont('Courier', 'bold');
          doc.setFontSize(12);
          doc.text(`[ BARCODE: ${el.valor_resolvido || ''} ]`, x, y + 12);
        }
        else if (el.tipo_elemento === 'qrcode') {
          doc.setFont('Courier', 'bold');
          doc.setFontSize(12);
          doc.text(`[ QR: ${el.valor_resolvido || ''} ]`, x, y + 12);
        }
      });

      doc.output('dataurlnewwindow');
    } catch (error) {
      console.error('Erro ao gerar PDF em tela:', error);
      alert('Houve um erro ao gerar o PDF. Verifique o console.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Impressão Operacional
          </h1>
          <Badge variant="primary">Centro de Impressão</Badge>
        </div>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Selecione o modelo desejado e preencha ou bipe as informações para gerar o documento oficial.
        </p>
      </div>

      {/* Cartão Principal de Impressão */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Impressão</CardTitle>
          <CardDescription>
            Escolha a categoria e o modelo de documento para carregar os parâmetros dinâmicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImprimir} className="space-y-6">
            
            {/* Filtro de Categorias */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                <Filter className="w-3.5 h-3.5 text-zinc-400" /> Filtrar por Categoria
              </label>
              <div className="flex gap-2 flex-wrap pt-1">
                <button 
                  type="button"
                  className={cn(
                    "px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 border",
                    categoriaSelecionada === ''
                      ? "bg-[#002972] text-white border-[#002972] shadow-sm"
                      : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  )}
                  onClick={() => { setCategoriaSelecionada(''); setTemplateSelecionado(''); }}
                >
                  Todas
                </button>
                {categorias.map(cat => (
                  <button 
                    key={cat.id} 
                    type="button"
                    className={cn(
                      "px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 border",
                      categoriaSelecionada === cat.id
                        ? "bg-[#002972] text-white border-[#002972] shadow-sm"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    )}
                    onClick={() => { setCategoriaSelecionada(cat.id); setTemplateSelecionado(''); }}
                  >
                    {cat.nome}
                  </button>
                ))}
              </div>
            </div>

            {/* Seleção do Modelo */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Modelo de Documento
              </label>
              <div className="relative">
                <select 
                  className={cn(
                    "w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-[#002972] focus:border-transparent shadow-sm"
                  )}
                  value={templateSelecionado} 
                  onChange={(e) => setTemplateSelecionado(e.target.value)}
                  required
                >
                  <option value="">-- SELECIONE O MODELO --</option>
                  {templatesFiltrados.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Campos Dinâmicos Baseados no Banco */}
            {camposDinamicos.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Parâmetros Necessários
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {camposDinamicos.map(campo => (
                    <Input 
                      key={campo.id}
                      type={campo.tipo_dado === 'numero' ? 'number' : 'text'}
                      label={campo.label_exibicao || campo.nome_campo || 'Campo Dinâmico'}
                      name={campo.nome_campo}
                      value={formData[campo.nome_campo] || ''}
                      onChange={handleInputChange}
                      placeholder={`Bipe ou digite ${campo.label_exibicao ? campo.label_exibicao.toLowerCase() : (campo.nome_campo || 'o valor')}`}
                      required
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Botão de Ação */}
            {templateSelecionado && (
              <div className="pt-2">
                <Button 
                  type="submit" 
                  variant="primary"
                  size="lg"
                  isLoading={loading}
                  leftIcon={<Printer className="w-5 h-5" />}
                  className="w-full text-base font-bold shadow-lg py-3 rounded-xl"
                >
                  GERAR DOCUMENTO / IMPRIMIR
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
      
      {/* Modal de Preenchimento Manual */}
      <Modal
        isOpen={!!pendingDocument}
        onClose={() => setPendingDocument(null)}
        title="Dados Faltantes"
        description="O sistema não encontrou as informações abaixo. Por favor, preencha manualmente para prosseguir com a impressão."
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPendingDocument(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="modal-manual-form" variant="primary">
              Confirmar e Imprimir
            </Button>
          </>
        }
      >
        {pendingDocument && (
          <form id="modal-manual-form" onSubmit={confirmarInputManual} className="space-y-4">
            {(() => {
              const elementosManuais = pendingDocument.elementos_finais
                .filter(el => el.precisa_input_manual)
                .sort((a, b) => {
                  if (Math.abs((a.posicao_y || 0) - (b.posicao_y || 0)) > 15) {
                    return (a.posicao_y || 0) - (b.posicao_y || 0);
                  }
                  return (a.posicao_x || 0) - (b.posicao_x || 0);
                });
              
              return elementosManuais.map((el, index) => (
                <div key={el.id} className="space-y-1">
                  <Input 
                    label={el.label_manual || 'Preenchimento Manual'}
                    value={manualInputs[el.id] || ''}
                    onChange={(e) => handleManualInputChange(el.id, e.target.value)}
                    onBlur={() => handleManualInputBlur(el)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (index < elementosManuais.length - 1) {
                          e.preventDefault();
                          const form = e.target.form;
                          const inputs = Array.from(form.querySelectorAll('input[type="text"]'));
                          const currentIdx = inputs.indexOf(e.target);
                          if (currentIdx > -1 && inputs[currentIdx + 1]) {
                            inputs[currentIdx + 1].focus();
                          }
                        }
                      }
                    }}
                    required={!el.is_opcional}
                  />
                </div>
              ));
            })()}
          </form>
        )}
      </Modal>

      {/* Preview dos Dados Retornados */}
      {documentoGerado && (
        <Card className="mt-6 border-emerald-200 dark:border-emerald-900/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle>Textos a Serem Impressos (Editável)</CardTitle>
              </div>
              <CardDescription>
                Os valores abaixo foram resolvidos a partir do banco de dados ou da sua digitação manual.
              </CardDescription>
            </div>
            <Button 
              variant="success" 
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={() => dispararImpressaoZebra(documentoGerado)}
            >
              Re-Imprimir
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-zinc-500 mb-3">
              Se houver algum erro de digitação, você pode corrigir diretamente aqui e clicar no botão para gerar novamente.
            </p>
            {documentoGerado.elementos_finais.map((el, index) => {
              if ((el.tipo_elemento === 'texto' || el.tipo_elemento === 'codigo_barras') && el.solicitar_manual_se_vazio) {
                const defaultLabel = el.fonte_dados === 'Estatico' ? `Elemento ${index+1} (Estático)` : `${el.fonte_dados}.${el.coluna_banco}`;
                const label = el.label_manual || defaultLabel;
                
                return (
                  <div className="flex items-center gap-4 py-2 border-b border-zinc-100 dark:border-zinc-800" key={el.id}>
                    <strong className="w-2/5 text-xs text-zinc-600 dark:text-zinc-300">{label}:</strong>
                    <div className="flex-1">
                      <Input
                        value={el.valor_resolvido || ''}
                        onChange={(e) => {
                          const novoDoc = JSON.parse(JSON.stringify(documentoGerado));
                          const elIndex = novoDoc.elementos_finais.findIndex(item => item.id === el.id);
                          if (elIndex > -1) {
                            novoDoc.elementos_finais[elIndex].valor_resolvido = e.target.value;
                            setDocumentoGerado(novoDoc);
                          }
                        }}
                        onBlur={(e) => {
                          const formatted = formatarMascara(e.target.value, el.mascara_dados);
                          if (formatted !== e.target.value) {
                            const novoDoc = JSON.parse(JSON.stringify(documentoGerado));
                            const elIndex = novoDoc.elementos_finais.findIndex(item => item.id === el.id);
                            if (elIndex > -1) {
                              novoDoc.elementos_finais[elIndex].valor_resolvido = formatted;
                              setDocumentoGerado(novoDoc);
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
