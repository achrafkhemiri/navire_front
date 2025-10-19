import { Component, OnInit } from '@angular/core';
import { DechargementControllerService } from '../../api/api/dechargementController.service';
import { ChargementControllerService } from '../../api/api/chargementController.service';
import { ClientControllerService } from '../../api/api/clientController.service';
import { DepotControllerService } from '../../api/api/depotController.service';
import { CamionControllerService } from '../../api/api/camionController.service';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { DechargementDTO } from '../../api/model/dechargementDTO';
import { ChargementDTO } from '../../api/model/chargementDTO';
import { ClientDTO } from '../../api/model/clientDTO';
import { DepotDTO } from '../../api/model/depotDTO';
import { CamionDTO } from '../../api/model/camionDTO';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { SocieteDTO } from '../../api/model/societeDTO';
import { ProjetActifService } from '../../service/projet-actif.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-dechargement',
  templateUrl: './dechargement.component.html',
  styleUrls: ['./dechargement.component.css']
})
export class DechargementComponent implements OnInit {
  dechargements: DechargementDTO[] = [];
  filteredDechargements: DechargementDTO[] = [];
  paginatedDechargements: DechargementDTO[] = [];
  clients: ClientDTO[] = [];
  depots: DepotDTO[] = [];
  chargements: ChargementDTO[] = [];
  camions: CamionDTO[] = [];
  chauffeurs: ChauffeurDTO[] = [];
  
  // Filters
  activeFilter: string = 'all';
  searchFilter: string = '';
  selectedSociete: string | null = null;
  selectedProjet: string | null = null;
  selectedProduit: string | null = null;
  selectedDate: string | null = null; // yyyy-MM-dd
  // Nouveaux filtres
  selectedNavire: string | null = null; // Par navire (au lieu de projet)
  selectedSocieteP: string | null = null; // Société liée au projet
  // Date max pour le filtre (aujourd'hui)
  today: string = '';
  allSocietes: string[] = [];
  allProjets: string[] = [];
  allProduits: string[] = [];
  allNavires: string[] = [];
  allPorts: string[] = [];
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizes: number[] = [5, 10, 25, 50, 100];
  totalPages: number = 1;
  
  // Sorting
  sortColumn: string = 'dateDechargement';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  // Delete confirmation
  showDeleteDialog: boolean = false;
  dechargementToDelete: DechargementDTO | null = null;
  
  error: string = '';
  isSidebarOpen: boolean = true;
  Math = Math;
  
  breadcrumbItems = [
    { label: 'Accueil', route: '/home' },
    { label: 'Déchargements', route: '/dechargement' }
  ];

  // Contexte projet
  projetActif: any = null;

  // Sociétés du projet actif (normalisées)
  get societesList(): string[] {
    const proj = this.projetActif as any;
    const set = proj?.societeNoms as Set<string> | string[] | undefined;
    if (!set) return [];
    try {
      return Array.isArray(set)
        ? (set as string[]).filter(Boolean)
        : Array.from(set as Set<string>).filter(Boolean);
    } catch {
      return [];
    }
  }

  get allDechargementsCount(): number {
    return this.dechargements.length;
  }

  constructor(
    private dechargementService: DechargementControllerService,
    private chargementService: ChargementControllerService,
    private clientService: ClientControllerService,
    private depotService: DepotControllerService,
    private camionService: CamionControllerService,
    private chauffeurService: ChauffeurControllerService,
    private projetActifService: ProjetActifService
  ) {}

  ngOnInit(): void {
    // Initialiser la date du jour pour limiter les sélections futures
    this.today = this.getTodayString();
    // Charger le projet actif pour l'afficher dans l'en-tête même s'il n'y a pas de données
    const storedProjet = this.projetActifService.getProjetActif();
    if (storedProjet) {
      this.projetActif = storedProjet;
    }
    this.projetActifService.projetActif$.subscribe(p => {
      if (p) this.projetActif = p;
    });

    this.loadDechargements();
    this.loadClients();
    this.loadDepots();
    this.loadChargements();
    this.loadCamions();
    this.loadChauffeurs();
  }

  loadDechargements(): void {
    this.dechargementService.getAllDechargements().subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.dechargements = JSON.parse(reader.result as string);
              this.extractFilters();
              this.applyFilter();
            } catch (e) {
              console.error('Erreur lors du parsing des déchargements:', e);
              this.error = 'Erreur lors du chargement des déchargements';
            }
          };
          reader.readAsText(data);
        } else {
          this.dechargements = data as any;
          this.extractFilters();
          this.applyFilter();
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des déchargements:', err);
        this.error = 'Impossible de charger les déchargements';
      }
    });
  }

  extractFilters(): void {
    const societesSet = new Set<string>();
    const projetsSet = new Set<string>();
    const produitsSet = new Set<string>();
    const naviresSet = new Set<string>();
    const portsSet = new Set<string>();

    this.dechargements.forEach(dech => {
      if (dech.societe) societesSet.add(dech.societe);
      if (dech.nomProjet) projetsSet.add(dech.nomProjet);
      if (dech.produit) produitsSet.add(dech.produit);
      if (dech.navire) naviresSet.add(dech.navire);
      if (dech.port) portsSet.add(dech.port);
    });

    this.allSocietes = Array.from(societesSet).sort();
    this.allProjets = Array.from(projetsSet).sort();
    this.allProduits = Array.from(produitsSet).sort();
    this.allNavires = Array.from(naviresSet).sort();
    this.allPorts = Array.from(portsSet).sort();
  }

  setFilter(filterType: string): void {
    this.activeFilter = filterType;
    if (filterType === 'all') {
      this.selectedSociete = null;
      this.selectedProjet = null;
      this.selectedProduit = null;
      this.selectedNavire = null;
      this.selectedSocieteP = null;
      this.selectedDate = null;
    }
    this.applyFilter();
  }

  applyFilter(): void {
    // Ne pas permettre une date future dans le filtre
    if (this.selectedDate && this.today && this.selectedDate > this.today) {
      this.selectedDate = this.today;
    }
    this.filteredDechargements = this.dechargements.filter(dech => {
      // Filter by date (workday window: 07:00 to next day 06:00)
      if (this.selectedDate) {
        const selectedDateObj = new Date(this.selectedDate + 'T00:00:00');
        const startWorkDay = new Date(selectedDateObj);
        startWorkDay.setHours(7, 0, 0, 0);
        const endWorkDay = new Date(selectedDateObj);
        endWorkDay.setDate(endWorkDay.getDate() + 1);
        endWorkDay.setHours(6, 0, 0, 0);

        const dechDate = dech.dateDechargement ? new Date(dech.dateDechargement) : null;
        const chgDate = dech.dateChargement ? new Date(dech.dateChargement) : null;
        const inWindow = (dechDate && dechDate >= startWorkDay && dechDate < endWorkDay) ||
                         (chgDate && chgDate >= startWorkDay && chgDate < endWorkDay);
        if (!inWindow) return false;
      }
      // Filter by société
      if (this.selectedSociete && dech.societe !== this.selectedSociete) {
        return false;
      }
      // Filter by navire (remplace le filtre projet)
      if (this.selectedNavire && dech.navire !== this.selectedNavire) {
        return false;
      }
      // Filtre par Société (Projet) - si on est dans le contexte d'un projet actif et qu'une société projet est sélectionnée,
      // restreindre aux déchargements de ce projet
      if (this.selectedSocieteP && this.projetActif && Array.isArray(this.societesList) && this.societesList.includes(this.selectedSocieteP)) {
        if (dech.projetId !== this.projetActif.id) {
          return false;
        }
      }
      
      // Filter by produit
      if (this.selectedProduit && dech.produit !== this.selectedProduit) {
        return false;
      }
      
      // Search filter
      if (this.searchFilter) {
        const searchLower = this.searchFilter.toLowerCase();
        return (
          dech.numTicket?.toLowerCase().includes(searchLower) ||
          dech.numBonLivraison?.toLowerCase().includes(searchLower) ||
          this.getClientName(dech.clientId).toLowerCase().includes(searchLower) ||
          this.getDepotName(dech.depotId).toLowerCase().includes(searchLower) ||
          dech.societe?.toLowerCase().includes(searchLower) ||
          dech.nomProjet?.toLowerCase().includes(searchLower) ||
          dech.produit?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });

    this.sortData();
    this.updatePagination();
  }

  // Helper: retourne aujourd'hui au format yyyy-MM-dd (heure locale)
  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Effacer un filtre spécifique
  clearFilter(filterType: 'societe' | 'projet' | 'produit' | 'date' | 'navire' | 'societeP') {
    switch (filterType) {
      case 'societe':
        this.selectedSociete = null;
        break;
      case 'projet':
        this.selectedProjet = null;
        break;
      case 'navire':
        this.selectedNavire = null;
        break;
      case 'societeP':
        this.selectedSocieteP = null;
        break;
      case 'produit':
        this.selectedProduit = null;
        break;
      case 'date':
        this.selectedDate = null;
        break;
    }
    this.applyFilter();
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc';
    }
    this.sortData();
    this.updatePagination();
  }

  sortData(): void {
    this.filteredDechargements.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (this.sortColumn === 'dateDechargement') {
        aValue = a.dateDechargement ? new Date(a.dateDechargement).getTime() : 0;
        bValue = b.dateDechargement ? new Date(b.dateDechargement).getTime() : 0;
      } else if (this.sortColumn === 'dateChargement') {
        aValue = a.dateChargement ? new Date(a.dateChargement).getTime() : 0;
        bValue = b.dateChargement ? new Date(b.dateChargement).getTime() : 0;
      } else if (this.sortColumn === 'numTicket') {
        aValue = a.numTicket || '';
        bValue = b.numTicket || '';
      }

      if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  changePageSize(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredDechargements.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedDechargements = this.filteredDechargements.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getPageNumbers(): number[] {
    const maxVisible = 5;
    const pages: number[] = [];
    
    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
      const end = Math.min(this.totalPages, start + maxVisible - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  loadChargements(): void {
    this.chargementService.getAllChargements().subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          const parsed = JSON.parse(text);
          this.chargements = Array.isArray(parsed) ? parsed : [];
        } else {
          this.chargements = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur chargement chargements:', err);
      }
    });
  }

  loadCamions(): void {
    this.camionService.getAllCamions().subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          const parsed = JSON.parse(text);
          this.camions = Array.isArray(parsed) ? parsed : [];
        } else {
          this.camions = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur chargement camions:', err);
      }
    });
  }

  loadChauffeurs(): void {
    this.chauffeurService.getAllChauffeurs().subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          const parsed = JSON.parse(text);
          this.chauffeurs = Array.isArray(parsed) ? parsed : [];
        } else {
          this.chauffeurs = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur chargement chauffeurs:', err);
      }
    });
  }

  loadClients(): void {
    this.clientService.getAllClients().subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.clients = JSON.parse(reader.result as string);
            } catch (e) {
              console.error('Erreur parsing clients:', e);
              this.clients = [];
            }
          };
          reader.readAsText(data);
        } else {
          this.clients = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des clients:', err);
        this.clients = [];
      }
    });
  }

  loadDepots(): void {
    this.depotService.getAllDepots().subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.depots = JSON.parse(reader.result as string);
            } catch (e) {
              console.error('Erreur parsing dépôts:', e);
              this.depots = [];
            }
          };
          reader.readAsText(data);
        } else {
          this.depots = Array.isArray(data) ? data : [];
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des dépôts:', err);
        this.depots = [];
      }
    });
  }

  getClientName(clientId: number | undefined): string {
    if (!clientId) return '';
    const client = this.clients.find(c => c.id === clientId);
    return client?.nom || '';
  }

  getDepotName(depotId: number | undefined): string {
    if (!depotId) return '';
    const depot = this.depots.find(d => d.id === depotId);
    return depot?.nom || '';
  }

  formatDateTime(dateTime: string | undefined): string {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateOnly(dateTime: string | undefined): string {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  formatTimeOnly(dateTime: string | undefined): string {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  exportToExcel(): void {
    const dataToExport = this.filteredDechargements.map(dech => ({
      'Date Déchargement': this.formatDateTime(dech.dateDechargement),
      'N° Ticket': dech.numTicket,
      'Bon Livraison': dech.numBonLivraison || '-',
      'Société': dech.societe || '-',
      'Client': this.getClientName(dech.clientId),
      'Dépôt': this.getDepotName(dech.depotId),
      'Poids Vide': dech.poidCamionVide?.toFixed(0),
      'Poids Complet': dech.poidComplet?.toFixed(0),
      'Poids Net': this.calculatePoidsNet(dech).toFixed(0)
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Déchargements');
    XLSX.writeFile(wb, `dechargements_${new Date().getTime()}.xlsx`);
  }

  calculatePoidsNet(dech: DechargementDTO): number {
    const poidComplet = dech.poidComplet || 0;
    const poidVide = dech.poidCamionVide || 0;
    return poidComplet - poidVide;
  }

  printTable(): void {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Liste des Déchargements</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #667eea; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; text-align: left; border: 1px solid #ddd; }
          th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
          .badge-success { background: #d1fae5; color: #065f46; }
          .badge-warning { background: #fef3c7; color: #92400e; }
          .badge-info { background: #e0e7ff; color: #4338ca; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Liste des Déchargements</h1>
        <p style="text-align: center; color: #64748b;">Imprimé le ${new Date().toLocaleString('fr-FR')}</p>
        <table>
          <thead>
            <tr>
              <th>Date Déchargement</th>
              <th>N° Ticket</th>
              <th>Bon Livraison</th>
              <th>Société</th>
              <th>Client</th>
              <th>Dépôt</th>
              <th>Poids Vide</th>
              <th>Poids Complet</th>
              <th>Poids Net</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredDechargements.map(dech => `
              <tr>
                <td>${this.formatDateTime(dech.dateDechargement)}</td>
                <td><span class="badge badge-info">${dech.numTicket}</span></td>
                <td>${dech.numBonLivraison || '-'}</td>
                <td>${dech.societe || '-'}</td>
                <td>${dech.clientId ? `<span class="badge badge-success">${this.getClientName(dech.clientId)}</span>` : '-'}</td>
                <td>${dech.depotId ? `<span class="badge badge-warning">${this.getDepotName(dech.depotId)}</span>` : '-'}</td>
                <td>${dech.poidCamionVide?.toFixed(0)}</td>
                <td>${dech.poidComplet?.toFixed(0)}</td>
                <td><strong>${this.calculatePoidsNet(dech).toFixed(0)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }

  printDechargement(dech: DechargementDTO): void {
    // Récupérer le chargement associé
    const chargement = this.chargements.find(c => c.id === dech.chargementId);
    const camion = chargement ? this.camions.find(c => c.id === chargement.camionId) : null;
    const chauffeur = chargement ? this.chauffeurs.find(c => c.id === chargement.chauffeurId) : null;
    const client = dech.clientId ? this.clients.find(c => c.id === dech.clientId) : null;
    const depot = dech.depotId ? this.depots.find(d => d.id === dech.depotId) : null;
    
    // Récupérer les informations de la société du projet
    let societeInfo: SocieteDTO | null = null;
    if (this.projetActif && Array.isArray(this.projetActif.societes)) {
      // Si le chargement a un nom de société, essayer de la trouver
      if (chargement?.societeP) {
        societeInfo = this.projetActif.societes.find((s: SocieteDTO) => s.nom === chargement.societeP) || null;
      }
      // Sinon prendre la première société du projet
      if (!societeInfo && this.projetActif.societes.length > 0) {
        societeInfo = this.projetActif.societes[0];
      }
    }

    // Date et heure formatées
    const dateDechargement = dech.dateDechargement ? new Date(dech.dateDechargement) : new Date();
    const dateFormatted = dateDechargement.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const heureDepart = dateDechargement.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Pour heure arrivée, on peut ajouter quelques minutes (simulation)
    const heureArrivee = new Date(dateDechargement.getTime() + 30 * 60000).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Préparer l'affichage du contact (peut être un JSON stringifié ou un tableau)
    let contactHtml = '';
    const rawContact = societeInfo?.contact;
    if (rawContact) {
      try {
      const parsed = typeof rawContact === 'string' ? JSON.parse(rawContact) : rawContact;
      if (Array.isArray(parsed)) {
        contactHtml = parsed
        .map(c => `<div>Tél : ${String(c)}</div>`)
        .join('');
      } else if (typeof parsed === 'object') {
        contactHtml = Object.values(parsed)
        .map(v => `<div>${String(v)}</div>`)
        .join('');
      } else {
        contactHtml = `<div>Contact : ${String(parsed)}</div>`;
      }
      } catch {
      // Si parsing échoue, afficher la valeur brute
      contactHtml = `<div>Contact : ${String(rawContact)}</div>`;
      }
    } else {
      contactHtml = '<div>TÉL : Tl 430 822</div><div>Fax : 71430 911</div>';
    }

    const hasMF = !!(depot?.mf || client?.mf);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
      <meta charset="UTF-8">
      <title>Bon de Sortie N° ${dech.numTicket}</title>
      <style>
      @page {
      size: A4;
      margin: 15mm;
      }
      
      * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      }
      
      body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: white;
      padding: 20px;
      }
      
      .print-button {
      display: block;
      width: 200px;
      margin: 0 auto 20px auto;
      padding: 12px 24px;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      
      .print-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 8px rgba(0,0,0,0.15);
      }
      
      .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: white;
      padding: 10mm;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      }
      
      .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
      }
      
      .company-info {
      flex: 1;
      }
      
      .company-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 3px;
      }
      
      .company-details {
      font-size: 10px;
      line-height: 1.5;
      }
      
      .delivery-info {
      text-align: right;
      flex: 1;
      }
      
      .delivery-title {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 5px;
      }
      
      .bon-number {
      font-size: 13px;
      font-weight: bold;
      margin: 5px 0;
      }
      
      .date-info {
      font-size: 11px;
      margin: 5px 0;
      }
      
      .main-content {
      margin-top: 20px;
      }
      
      .info-row {
      display: flex;
      margin-bottom: 8px;
      font-size: 11px;
      }
      
      .info-label {
      width: 150px;
      font-weight: bold;
      }
      
      .info-value {
      flex: 1;
      padding-left: 10px;
      }
      
      .section-title {
      font-size: 12px;
      font-weight: bold;
      margin: 20px 0 10px 0;
      padding: 5px;
      background: #f0f0f0;
      border-left: 4px solid #000;
      }
      
      .vehicle-section {
      margin: 20px 0;
      }
      
      .table-container {
      margin: 20px 0;
      border: 1px solid #000;
      }
      
      table {
      width: 100%;
      border-collapse: collapse;
      }
      
      th {
      background: #f0f0f0;
      padding: 8px;
      text-align: center;
      font-weight: bold;
      border: 1px solid #000;
      font-size: 11px;
      }
      
      td {
      padding: 8px;
      text-align: center;
      border: 1px solid #000;
      font-size: 11px;
      }
      
      .total-row {
      font-weight: bold;
      background: #f8f8f8;
      font-size: 12px;
      }
      
      .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px dashed #666;
      }
      
      .footer-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 10px;
      }
      
      .signature-section {
      display: flex;
      justify-content: space-around;
      margin-top: 40px;
      }
      
      .signature-box {
      text-align: center;
      width: 200px;
      }
      
      .signature-label {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 40px;
      padding-bottom: 5px;
      border-bottom: 1px solid #000;
      }
      
      @media print {
      body {
        padding: 0;
      }
      
      .page {
        box-shadow: none;
        margin: 0;
        padding: 10mm;
      }
      
      .print-button {
        display: none;
      }
      }
      </style>
      </head>
      <body>
      <button class="print-button" onclick="window.print()">
      🖨️ Imprimer le Bon de chargement
      </button>
      
      <div class="page">
      <!-- En-tête -->
      <div class="header">
      <div class="company-info">
        <div class="company-name">Société : ${societeInfo?.nom || chargement?.societeP || 'SNA'}</div>
        <div class="company-details">
        <div>STÉ ${societeInfo?.nom || chargement?.societeP || 'SNA'}</div>
        ${societeInfo?.adresse ? `<div>Adresse: ${societeInfo.adresse}</div>` : ''}
        ${societeInfo?.rcs ? `<div>N° RCS : ${societeInfo.rcs}</div>` : ''}
        ${societeInfo?.tva ? `<div>N° TVA : ${societeInfo.tva}</div>` : '<div>MF : 000349528W000</div>'}
        ${contactHtml}
        </div>
      </div>
      
      <div class="delivery-info">
        <div class="delivery-title">Adresse Livraison : ${depot?.nom || client?.nom }</div>
        <div class="company-details">
        <div>&nbsp;</div>
        <div>Adresse : ${depot?.adresse || client?.adresse}</div>
        ${hasMF ? `<div>MF : ${depot?.mf || client?.mf}</div>
        ` : ''}

        </div>
      </div>
      </div>
      
      <!-- Informations du bon -->
      <div style="text-align: center; margin: 15px 0;">
      <div class="bon-number">Bon de sortie N° : ${dech.numTicket || 'SB017418'}</div>
      <div class="date-info">
        Date : ${dateFormatted}
        <span style="margin-left: 40px;">Heure Départ : ${heureDepart}</span>
      </div>
      <div class="date-info">
        Paie M. : ${dech.numBonLivraison || 'PL000148'}
        <span style="margin-left: 20px;">Navire : ${dech.navire || '25020'}</span>
        <span style="margin-left: 40px;">N° Ticket : ${dech.numTicket || '44'}</span>
      </div>
      <div class="date-info">Heure Arrivée : ${heureArrivee}</div>
      </div>
      
      <!-- Informations port -->
      <div class="main-content">
      <div class="info-row">
        <div class="info-label">Port :</div>
        <div class="info-value">${dech.port || 'BIZERTE'}</div>
      </div>
      </div>
      
      <!-- Informations véhicule -->
      <div class="section-title">VÉHICULE</div>
      <div class="vehicle-section">
      <div class=
          <tr>
            <td>${dech.produit || 'Tourteaux de Colza'}</td>
            <td>${(dech.poidComplet! / 1000).toFixed(2)}</td>
            <td>${(dech.poidCamionVide! / 1000).toFixed(2)}</td>
            <td>${(this.calculatePoidsNet(dech) / 1000).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Circuit</td>
            <td>Agent Port</td>
            <td>Chauffeur</td>
            <td>Magasinier</td>
          </tr>
          </tbody>
        </table>
        </div>
        
        <!-- Footer avec informations additionnelles -->
        <div class="footer">
        <div class="footer-row">
          <span><strong>Client:</strong> ${client?.nom || dech.societe || 'N/A'}</span>
          <span><strong>Dépôt:</strong> ${depot?.nom || 'N/A'}</span>
        </div>
        <div class="footer-row">
          <span><strong>Bon de Livraison:</strong> ${dech.numBonLivraison || 'N/A'}</span>
          <span><strong>Projet:</strong> ${dech.nomProjet || 'N/A'}</span>
        </div>
        </div>
        
        <!-- Signatures -->
        <div class="signature-section">
        <div class="signature-box">
          <div class="signature-label">Signature Agent Port</div>
        </div>
        <div class="signature-box">
          <div class="signature-label">Signature Chauffeur</div>
        </div>
        <div class="signature-box">
          <div class="signature-label">Signature Magasinier</div>
        </div>
        </div>
      </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  }

  editDechargement(dech: DechargementDTO): void {
    alert('Fonction d\'édition en cours de développement');
  }

  openDeleteDialog(dech: DechargementDTO): void {
    this.dechargementToDelete = dech;
    this.showDeleteDialog = true;
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog = false;
    this.dechargementToDelete = null;
  }

  confirmDelete(): void {
    if (this.dechargementToDelete && this.dechargementToDelete.id) {
      this.dechargementService.deleteDechargement(this.dechargementToDelete.id).subscribe({
        next: () => {
          this.loadDechargements();
          this.closeDeleteDialog();
        },
        error: (err) => {
          console.error('Erreur lors de la suppression:', err);
          this.error = 'Erreur lors de la suppression du déchargement';
          this.closeDeleteDialog();
        }
      });
    }
  }
}
