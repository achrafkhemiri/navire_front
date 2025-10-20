import { Component, OnInit } from '@angular/core';
import { DechargementControllerService } from '../../api/api/dechargementController.service';
import { ChargementControllerService } from '../../api/api/chargementController.service';
import { ClientControllerService } from '../../api/api/clientController.service';
import { DepotControllerService } from '../../api/api/depotController.service';
import { CamionControllerService } from '../../api/api/camionController.service';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { DechargementDTO } from '../../api/model/dechargementDTO';
import { ChargementDTO } from '../../api/model/chargementDTO';
import { ClientDTO } from '../../api/model/clientDTO';
import { DepotDTO } from '../../api/model/depotDTO';
import { CamionDTO } from '../../api/model/camionDTO';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { SocieteDTO } from '../../api/model/societeDTO';
import { ProjetActifService } from '../../service/projet-actif.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forkJoin } from 'rxjs';

// Interface étendue pour le dialog d'édition
interface DechargementEditDTO extends Partial<DechargementDTO> {
  _type?: 'client' | 'depot';
  societeP?: string;
}

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
  dateDebut: string | null = null;
  dateFin: string | null = null;
  // Nouveau filtre
  selectedSocieteP: string | null = null; // Société liée au projet
  // Date max pour le filtre (aujourd'hui)
  today: string = '';
  allSocietes: string[] = [];
  allProjets: string[] = [];
  allPorts: string[] = [];
  allSocietesP: string[] = []; // Toutes les sociétés de projets
  
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
  
  // Edit dialog
  showEditDialog: boolean = false;
  selectedDechargement: DechargementDTO | null = null;
  dialogDechargement: DechargementEditDTO = {};
  editMode: boolean = false;
  
  // Recherche client/depot pour edit
  clientSearchInput: string = '';
  depotSearchInput: string = '';
  filteredClientsSearch: any[] = [];
  filteredDepotsSearch: any[] = [];
  showClientDropdown: boolean = false;
  showDepotDropdown: boolean = false;
  
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
    private voyageService: VoyageControllerService,
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
    const societesPSet = new Set<string>();

    this.dechargements.forEach(dech => {
      if (dech.societe) societesSet.add(dech.societe);
      if (dech.nomProjet) projetsSet.add(dech.nomProjet);
      if (dech.port) portsSet.add(dech.port);
      
      // Extraire societeP depuis le chargement
      const societeP = this.getSocieteP(dech);
      if (societeP && societeP !== '-') {
        societesPSet.add(societeP);
      }
    });

    this.allSocietes = Array.from(societesSet).sort();
    this.allProjets = Array.from(projetsSet).sort();
    this.allPorts = Array.from(portsSet).sort();
    this.allSocietesP = Array.from(societesPSet).sort();
  }

  setFilter(filterType: string): void {
    this.activeFilter = filterType;
    if (filterType === 'all') {
      this.selectedSociete = null;
      this.selectedProjet = null;
      this.selectedSocieteP = null;
      this.dateDebut = null;
      this.dateFin = null;
    }
    this.applyFilter();
  }

  applyFilter(): void {
    // Ne pas permettre une date future dans le filtre
    if (this.dateDebut && this.today && this.dateDebut > this.today) {
      this.dateDebut = this.today;
    }
    if (this.dateFin && this.today && this.dateFin > this.today) {
      this.dateFin = this.today;
    }
    this.filteredDechargements = this.dechargements.filter(dech => {
      // Filtre par date avec journée de travail (7h00 → 6h00 lendemain)
      if (this.dateDebut || this.dateFin) {
        const startDate = this.dateDebut ? new Date(this.dateDebut + 'T00:00:00') : new Date('1900-01-01');
        const endDate = this.dateFin ? new Date(this.dateFin + 'T00:00:00') : new Date();
        
        const dechDate = dech.dateDechargement ? new Date(dech.dateDechargement) : null;
        const chgDate = dech.dateChargement ? new Date(dech.dateChargement) : null;
        
        let inWindow = false;
        
        // Vérifier si le déchargement ou chargement tombe dans l'une des journées de travail de la plage
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const workDayStart = new Date(d);
          workDayStart.setHours(7, 0, 0, 0);
          const workDayEnd = new Date(d);
          workDayEnd.setDate(workDayEnd.getDate() + 1);
          workDayEnd.setHours(6, 0, 0, 0);
          
          if ((dechDate && dechDate >= workDayStart && dechDate < workDayEnd) ||
              (chgDate && chgDate >= workDayStart && chgDate < workDayEnd)) {
            inWindow = true;
            break;
          }
        }
        
        if (!inWindow) return false;
      }
      // Filter by société
      if (this.selectedSociete && dech.societe !== this.selectedSociete) {
        return false;
      }
      // Filtre par Société (Projet) - filtrer par la société du chargement
      if (this.selectedSocieteP) {
        const societeP = this.getSocieteP(dech);
        if (societeP !== this.selectedSocieteP) {
          return false;
        }
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
          dech.nomProjet?.toLowerCase().includes(searchLower)
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
  clearFilter(filterType: 'societe' | 'projet' | 'date' | 'societeP') {
    switch (filterType) {
      case 'societe':
        this.selectedSociete = null;
        break;
      case 'projet':
        this.selectedProjet = null;
        break;
      case 'societeP':
        this.selectedSocieteP = null;
        break;
      case 'date':
        this.dateDebut = null;
        this.dateFin = null;
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
        // Recharger les filtres après avoir chargé les chargements
        // car extractFilters() a besoin des chargements pour obtenir societeP
        if (this.dechargements.length > 0) {
          this.extractFilters();
          this.applyFilter();
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

  getSocieteP(dech: DechargementDTO): string {
    if (!dech.chargementId) return '-';
    const chargement = this.chargements.find(c => c.id === dech.chargementId);
    return chargement?.societeP || '-';
  }

  getNavire(dech: DechargementDTO): string {
    if (!dech.chargementId) return '-';
    const chargement = this.chargements.find(c => c.id === dech.chargementId);
    return chargement?.navire || '-';
  }

  getPort(dech: DechargementDTO): string {
    if (!dech.chargementId) return '-';
    const chargement = this.chargements.find(c => c.id === dech.chargementId);
    return chargement?.port || '-';
  }

  getProduit(dech: DechargementDTO): string {
    if (!dech.chargementId) return '-';
    const chargement = this.chargements.find(c => c.id === dech.chargementId);
    return chargement?.produit || '-';
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
    // Récupérer les informations uniques de navire, port et produit
    const naviresSet = new Set<string>();
    const portsSet = new Set<string>();
    const produitsSet = new Set<string>();
    
    this.filteredDechargements.forEach(dech => {
      const navire = this.getNavire(dech);
      const port = this.getPort(dech);
      const produit = this.getProduit(dech);
      
      if (navire && navire !== '-') naviresSet.add(navire);
      if (port && port !== '-') portsSet.add(port);
      if (produit && produit !== '-') produitsSet.add(produit);
    });

    const navires = Array.from(naviresSet).join(', ');
    const ports = Array.from(portsSet).join(', ');
    const produits = Array.from(produitsSet).join(', ');
    const filterLabel = this.getActiveFilterLabel();

    // Calculer les statistiques
    const nombreDechargements = this.filteredDechargements.length;
    const totalPoidsNet = this.filteredDechargements.reduce((sum, dech) => {
      return sum + this.calculatePoidsNet(dech);
    }, 0);

    // Créer le workbook
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([]);

    // Ajouter l'en-tête avec les informations
    let currentRow = 0;
    XLSX.utils.sheet_add_aoa(ws, [['LISTE DES BONS DE CHARGEMENT']], { origin: { r: currentRow, c: 0 } });
    ws['!merges'] = ws['!merges'] || [];
    ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
    currentRow++;

    if (navires) {
      XLSX.utils.sheet_add_aoa(ws, [[`Navire: ${navires}`]], { origin: { r: currentRow, c: 0 } });
      ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
      currentRow++;
    }

    if (ports) {
      XLSX.utils.sheet_add_aoa(ws, [[`Port: ${ports}`]], { origin: { r: currentRow, c: 0 } });
      ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
      currentRow++;
    }

    if (produits) {
      XLSX.utils.sheet_add_aoa(ws, [[`Produit: ${produits}`]], { origin: { r: currentRow, c: 0 } });
      ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
      currentRow++;
    }

    // Ajouter les statistiques
    XLSX.utils.sheet_add_aoa(ws, [[`Nombre de Bons de Chargement: ${nombreDechargements}`]], { origin: { r: currentRow, c: 0 } });
    ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
    currentRow++;

    XLSX.utils.sheet_add_aoa(ws, [[`Total Poids Net: ${Math.round(totalPoidsNet)} kg`]], { origin: { r: currentRow, c: 0 } });
    ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
    currentRow++;

    XLSX.utils.sheet_add_aoa(ws, [[`Filtre: ${filterLabel}`]], { origin: { r: currentRow, c: 0 } });
    ws['!merges'].push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 9 } });
    currentRow++;

    // Ajouter une ligne vide
    currentRow++;

    // Préparer les données
    const dataToExport = this.filteredDechargements.map(dech => ({
      'Date': this.formatDateTime(dech.dateDechargement),
      'N° Ticket': dech.numTicket,
      'Bon Livraison': dech.numBonLivraison || '-',
      'Société': this.getSocieteP(dech),
      'Transporteur': dech.societe || '-',
      'Client': this.getClientName(dech.clientId),
      'Dépôt': this.getDepotName(dech.depotId),
      'Poids Tar': dech.poidCamionVide?.toFixed(0),
      'Poids Brut': dech.poidComplet?.toFixed(0),
      'Poids Net': this.calculatePoidsNet(dech).toFixed(0)
    }));

    // Ajouter les données
    XLSX.utils.sheet_add_json(ws, dataToExport, { origin: { r: currentRow, c: 0 } });

    // Ajouter la feuille au workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Bons de Chargement');
    
    // Générer le nom du fichier avec la date actuelle et le filtre
    const fileName = this.generateFileName('xlsx');
    
    // Exporter avec le nouveau nom
    XLSX.writeFile(wb, fileName);
  }

  calculatePoidsNet(dech: DechargementDTO): number {
    const poidComplet = dech.poidComplet || 0;
    const poidVide = dech.poidCamionVide || 0;
    return poidComplet - poidVide;
  }

  exportToPDF(): void {
    // Récupérer les informations uniques de navire, port et produit
    const naviresSet = new Set<string>();
    const portsSet = new Set<string>();
    const produitsSet = new Set<string>();
    
    this.filteredDechargements.forEach(dech => {
      const navire = this.getNavire(dech);
      const port = this.getPort(dech);
      const produit = this.getProduit(dech);
      
      if (navire && navire !== '-') naviresSet.add(navire);
      if (port && port !== '-') portsSet.add(port);
      if (produit && produit !== '-') produitsSet.add(produit);
    });

    const navires = Array.from(naviresSet).join(', ');
    const ports = Array.from(portsSet).join(', ');
    const produits = Array.from(produitsSet).join(', ');
    const filterLabel = this.getActiveFilterLabel();

    // Calculer les statistiques
    const nombreDechargements = this.filteredDechargements.length;
    const totalPoidsNet = this.filteredDechargements.reduce((sum, dech) => {
      return sum + this.calculatePoidsNet(dech);
    }, 0);

    // Créer le PDF en mode paysage (landscape)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Titre principal
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTE DES BONS DE CHARGEMENT', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

    let yPosition = 25;

    // Informations du projet
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (navires) {
      doc.text(`Navire: ${navires}`, 14, yPosition);
      yPosition += 5;
    }
    if (ports) {
      doc.text(`Port: ${ports}`, 14, yPosition);
      yPosition += 5;
    }
    if (produits) {
      doc.text(`Produit: ${produits}`, 14, yPosition);
      yPosition += 5;
    }
    doc.text(`Nombre de Bons de Chargement: ${nombreDechargements}`, 14, yPosition);
    yPosition += 5;
    doc.text(`Total Poids Net: ${Math.round(totalPoidsNet)} kg`, 14, yPosition);
    yPosition += 5;
    doc.text(`Filtre: ${filterLabel}`, 14, yPosition);
    yPosition += 8;

    // Préparer les données du tableau
    const tableData = this.filteredDechargements.map(dech => {
      const client = this.clients.find(c => c.id === dech.clientId);
      const depot = this.depots.find(d => d.id === dech.depotId);
      
      return [
        dech.dateDechargement ? this.formatDateTime(dech.dateDechargement) : '',
        dech.numTicket || '',
        dech.numBonLivraison || '',
        this.getSocieteP(dech) || '',
        dech.societe || '',
        client?.nom || '',
        depot?.nom || '',
        Math.round(dech.poidCamionVide || 0).toString(),
        Math.round(dech.poidComplet || 0).toString(),
        Math.round(this.calculatePoidsNet(dech)).toString()
      ];
    });

    // Créer le tableau avec autoTable
    autoTable(doc, {
      startY: yPosition,
      head: [[
        'Date',
        'N° Ticket',
        'Bon Livraison',
        'Société',
        'Transporteur',
        'Client',
        'Dépôt',
        'Poids Tar',
        'Poids Brut',
        'Poids Net'
      ]],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: {
        fillColor: [102, 126, 234],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 30 },  // Date
        1: { cellWidth: 20 },  // N° Ticket
        2: { cellWidth: 25 },  // Bon Livraison
        3: { cellWidth: 30 },  // Société
        4: { cellWidth: 30 },  // Transporteur
        5: { cellWidth: 30, fillColor: [209, 250, 229] },  // Client (vert)
        6: { cellWidth: 30, fillColor: [254, 243, 199] },  // Dépôt (jaune)
        7: { cellWidth: 20, halign: 'right' },  // Poids Tar
        8: { cellWidth: 20, halign: 'right' },  // Poids Brut
        9: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }   // Poids Net
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      margin: { left: 14, right: 14 }
    });

    // Générer le nom du fichier avec la date actuelle et le filtre
    const fileName = this.generateFileName('pdf');

    // Télécharger le PDF
    doc.save(fileName);
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
      if (chargement?.societeP) {
        societeInfo = this.projetActif.societes.find((s: SocieteDTO) => s.nom === chargement.societeP) || null;
      }
      if (!societeInfo && this.projetActif.societes.length > 0) {
        societeInfo = this.projetActif.societes[0];
      }
    }

    // Date et heure formatées
    const dateDechargement = dech.dateDechargement ? new Date(dech.dateDechargement) : new Date();
    const dateFormatted = dateDechargement.toLocaleDateString('fr-FR');
    const heureDepart = dateDechargement.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Préparer le contact
    let contactText = '';
    const rawContact = societeInfo?.contact;
    if (rawContact) {
      try {
        const parsed = typeof rawContact === 'string' ? JSON.parse(rawContact) : rawContact;
        if (Array.isArray(parsed)) {
          contactText = parsed.map(c => `Tel: ${String(c)}`).join(', ');
        } else if (typeof parsed === 'object') {
          contactText = Object.values(parsed).map(v => String(v)).join(', ');
        } else {
          contactText = `Contact: ${String(parsed)}`;
        }
      } catch {
        contactText = `Contact: ${String(rawContact)}`;
      }
    } else {
      contactText = 'Tel: 71 430 822, Fax: 71 430 911';
    }

    const poidsNet = this.calculatePoidsNet(dech);

    // Créer une fenêtre d'impression avec le contenu HTML
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bon de Sortie - ${dech.numTicket || 'N/A'}</title>
        <style>
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
          }
          .header-left, .header-right {
            flex: 1;
          }
          .header-left {
            font-size: 12px;
            line-height: 1.6;
          }
          .header-right {
            text-align: right;
            font-size: 12px;
            line-height: 1.6;
          }
          .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .title-section {
            text-align: center;
            margin: 30px 0;
          }
          .main-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 15px;
            text-transform: uppercase;
          }
          .bon-info {
            font-size: 14px;
            font-weight: bold;
            margin: 8px 0;
          }
          .product-info {
            text-align: center;
            font-size: 12px;
            margin: 20px 0;
            line-height: 1.8;
          }
          .vehicle-info {
            display: flex;
            justify-content: space-between;
            margin: 25px 0;
            font-size: 13px;
            font-weight: bold;
          }
          .vehicle-left, .vehicle-right {
            flex: 1;
            line-height: 1.8;
          }
          .poids-table {
            width: 80%;
            margin: 30px auto;
            border-collapse: collapse;
            font-size: 14px;
          }
          .poids-table th {
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #333;
          }
          .poids-table td {
            padding: 15px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #333;
            font-size: 16px;
          }
          .signatures {
            display: flex;
            justify-content: space-around;
            margin-top: 60px;
            padding-top: 20px;
          }
          .signature-block {
            text-align: center;
            width: 40%;
          }
          .signature-label {
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 5px;
          }
          .signature-line {
            border-top: 2px solid #333;
            margin-top: 50px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="company-name">Société: ${societeInfo?.nom || chargement?.societeP || 'SNA'}</div>
            ${societeInfo?.adresse ? `<div>Adresse: ${societeInfo.adresse}</div>` : ''}
            ${societeInfo?.rcs ? `<div>N° RCS: ${societeInfo.rcs}</div>` : ''}
            ${societeInfo?.tva ? `<div>N° TVA: ${societeInfo.tva}</div>` : '<div>MF: 000349528W000</div>'}
            <div>${contactText}</div>
          </div>
          <div class="header-right">
            <div style="font-weight: bold;">Adresse Livraison:</div>
            <div>${depot?.nom || client?.nom || 'N/A'}</div>
            <div>Adresse: ${depot?.adresse || client?.adresse || 'N/A'}</div>
            ${(depot?.mf || client?.mf) ? `<div>MF: ${depot?.mf || client?.mf}</div>` : ''}
          </div>
        </div>

        <div class="title-section">
          <div class="main-title">BON DE SORTIE</div>
          <div class="bon-info">N° Bon: ${dech.numBonLivraison || 'N/A'}</div>
          <div class="bon-info">N° Ticket: ${dech.numTicket || 'N/A'}</div>
        </div>

        <div class="product-info">
          <div><strong>Produit:</strong> ${dech.produit || 'N/A'} &nbsp;&nbsp;&nbsp; <strong>Navire:</strong> ${dech.navire || 'N/A'} &nbsp;&nbsp;&nbsp; <strong>Port:</strong> ${dech.port || 'N/A'}</div>
          <div><strong>Date:</strong> ${dateFormatted} &nbsp;&nbsp;&nbsp; <strong>Heure Départ:</strong> ${heureDepart}</div>
        </div>

        <div class="vehicle-info">
          <div class="vehicle-left">
            <div>VEHICULE: ${camion?.matricule || 'N/A'}</div>
            <div>Chauffeur: ${chauffeur?.nom || 'N/A'}</div>
          </div>
          <div class="vehicle-right">
            <div>Transporteur: ${camion?.societe || dech.societe || 'N/A'}</div>
            <div>CIN: ${chauffeur?.numCin || 'N/A'}</div>
          </div>
        </div>

        <table class="poids-table">
          <thead>
            <tr>
              <th>Poids Brut</th>
              <th>Poids Tare</th>
              <th>Poids Net</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${Math.round(dech.poidComplet || 0)}</td>
              <td>${Math.round(dech.poidCamionVide || 0)}</td>
              <td>${Math.round(poidsNet)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="signature-block">
            <div class="signature-label">Signature Agent Port</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-block">
            <div class="signature-label">Signature Chauffeur</div>
            <div class="signature-line"></div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Ouvrir une nouvelle fenêtre et imprimer
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Attendre que le contenu soit chargé avant d'imprimer
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  editDechargement(dech: DechargementDTO): void {
    this.editMode = true;
    this.selectedDechargement = dech;
    this.dialogDechargement = { ...dech } as DechargementEditDTO;
    
    // Récupérer le chargement associé pour obtenir societeP
    const chargement = this.chargements.find(c => c.id === dech.chargementId);
    if (chargement) {
      this.dialogDechargement.societeP = chargement.societeP;
    }
    
    // Initialiser le type en fonction du client ou dépôt
    if (dech.clientId) {
      this.dialogDechargement._type = 'client';
      const client = this.clients.find(c => c.id === dech.clientId);
      this.clientSearchInput = client ? client.nom || '' : '';
    } else if (dech.depotId) {
      this.dialogDechargement._type = 'depot';
      const depot = this.depots.find(d => d.id === dech.depotId);
      this.depotSearchInput = depot ? depot.nom || '' : '';
    } else {
      this.dialogDechargement._type = 'client';
    }
    
    // Convertir la date au format datetime-local (yyyy-MM-ddTHH:mm)
    if (this.dialogDechargement.dateDechargement) {
      const date = new Date(this.dialogDechargement.dateDechargement);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      this.dialogDechargement.dateDechargement = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    this.showEditDialog = true;
    this.error = '';
  }

  closeEditDialog(): void {
    this.showEditDialog = false;
    this.editMode = false;
    this.selectedDechargement = null;
    this.dialogDechargement = {};
    this.clientSearchInput = '';
    this.depotSearchInput = '';
    this.filteredClientsSearch = [];
    this.filteredDepotsSearch = [];
    this.showClientDropdown = false;
    this.showDepotDropdown = false;
    this.error = '';
  }

  // Recherche client pour édition
  onClientSearchInput(): void {
    this.showClientDropdown = true;
    const searchLower = this.clientSearchInput.toLowerCase().trim();
    if (!searchLower) {
      this.filteredClientsSearch = this.clients.slice(0, 20);
    } else {
      this.filteredClientsSearch = this.clients.filter(c =>
        c.nom?.toLowerCase().includes(searchLower) ||
        c.numero?.toString().includes(searchLower)
      ).slice(0, 20);
    }
  }

  selectClientForEdit(client: any): void {
    this.dialogDechargement.clientId = client.id;
    this.dialogDechargement.depotId = undefined;
    this.clientSearchInput = client.nom || '';
    this.showClientDropdown = false;
  }

  // Recherche dépôt pour édition
  onDepotSearchInput(): void {
    this.showDepotDropdown = true;
    const searchLower = this.depotSearchInput.toLowerCase().trim();
    if (!searchLower) {
      this.filteredDepotsSearch = this.depots.slice(0, 20);
    } else {
      this.filteredDepotsSearch = this.depots.filter(d =>
        d.nom?.toLowerCase().includes(searchLower)
      ).slice(0, 20);
    }
  }

  selectDepotForEdit(depot: any): void {
    this.dialogDechargement.depotId = depot.id;
    this.dialogDechargement.clientId = undefined;
    this.depotSearchInput = depot.nom || '';
    this.showDepotDropdown = false;
  }

  saveDechargement(): void {
    // Validation
    if (!this.dialogDechargement.numTicket || !this.dialogDechargement.poidComplet || 
        !this.dialogDechargement.poidCamionVide) {
      this.error = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    // Préparer les données pour l'envoi
    const dechargementToSave = { ...this.dialogDechargement } as DechargementDTO;
    
    // Ajouter les secondes si nécessaire
    if (dechargementToSave.dateDechargement && dechargementToSave.dateDechargement.length === 16) {
      dechargementToSave.dateDechargement = dechargementToSave.dateDechargement + ':00';
    }

    if (this.editMode && this.selectedDechargement?.id) {
      // Conserver les anciennes valeurs pour trouver le voyage correspondant
      const oldNumBonLivraison = this.selectedDechargement.numBonLivraison;
      const oldNumTicket = this.selectedDechargement.numTicket;
      
      this.dechargementService.updateDechargement(this.selectedDechargement.id, dechargementToSave).subscribe({
        next: () => {
          // Synchroniser avec le voyage lié en utilisant les anciennes valeurs pour la recherche
          this.syncVoyageFromDechargement(dechargementToSave, oldNumBonLivraison, oldNumTicket);
          this.loadDechargements();
          this.closeEditDialog();
        },
        error: (err) => {
          console.error('Erreur mise à jour:', err);
          this.error = 'Erreur lors de la mise à jour du déchargement';
        }
      });
    }
  }

  // Synchroniser le voyage quand le déchargement est modifié
  syncVoyageFromDechargement(dech: DechargementDTO, oldNumBonLivraison?: string, oldNumTicket?: string): void {
    console.log('🔄 Début synchronisation Déchargement → Voyage');
    console.log('Déchargement:', dech);
    
    // Utiliser les anciennes valeurs si fournies, sinon les valeurs actuelles
    const searchBonLivraison = oldNumBonLivraison || dech.numBonLivraison;
    const searchTicket = oldNumTicket || dech.numTicket;
    
    if (!searchBonLivraison || !searchTicket) {
      console.warn('⚠️ Synchronisation annulée: numBonLivraison ou numTicket manquant');
      return;
    }

    console.log(`🔍 Recherche voyage avec Bon: ${searchBonLivraison}, Ticket: ${searchTicket}`);
    if (oldNumBonLivraison || oldNumTicket) {
      console.log(`📝 Nouvelles valeurs: Bon: ${dech.numBonLivraison}, Ticket: ${dech.numTicket}`);
    }

    // Trouver le voyage correspondant
    this.voyageService.getAllVoyages().subscribe({
      next: (voyages: any) => {
        let voyagesList: VoyageDTO[] = [];
        
        if (voyages instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              voyagesList = JSON.parse(reader.result as string);
              console.log(`📦 ${voyagesList.length} voyages chargés (Blob)`);
              this.updateMatchingVoyage(voyagesList, dech, searchBonLivraison, searchTicket);
            } catch (e) {
              console.error('❌ Erreur parsing voyages:', e);
            }
          };
          reader.readAsText(voyages);
        } else {
          voyagesList = voyages;
          console.log(`📦 ${voyagesList.length} voyages chargés (JSON direct)`);
          this.updateMatchingVoyage(voyagesList, dech, searchBonLivraison, searchTicket);
        }
      },
      error: (err) => {
        console.error('❌ Erreur récupération voyages:', err);
      }
    });
  }

  updateMatchingVoyage(voyages: VoyageDTO[], dech: DechargementDTO, searchBonLivraison: string, searchTicket: string): void {
    console.log('🔍 Recherche du voyage correspondant parmi', voyages.length, 'voyages');
    
    const matchingVoyage = voyages.find(v => 
      v.numBonLivraison === searchBonLivraison && 
      v.numTicket === searchTicket
    );

    if (!matchingVoyage) {
      console.warn('⚠️ Aucun voyage trouvé avec Bon:', dech.numBonLivraison, 'Ticket:', dech.numTicket);
      return;
    }

    console.log('✅ Voyage correspondant trouvé:', matchingVoyage);

    if (!matchingVoyage.id) {
      console.error('❌ Voyage sans ID, impossible de mettre à jour');
      return;
    }

    // Calculer le poids net du déchargement
    const poidsNet = (dech.poidComplet || 0) - (dech.poidCamionVide || 0);

    // Préparer le payload pour la mise à jour comme dans voyage.component
    const payload: any = {
      id: matchingVoyage.id,
      numBonLivraison: (dech.numBonLivraison || matchingVoyage.numBonLivraison)?.trim(),
      numTicket: (dech.numTicket || matchingVoyage.numTicket)?.trim(),
      reste: matchingVoyage.reste != null ? Number(matchingVoyage.reste) : 0,
      date: dech.dateDechargement || matchingVoyage.date,
      societe: (dech.societe || matchingVoyage.societe)?.trim() || undefined,
      societeP: matchingVoyage.societeP?.trim(),
      chauffeurId: dech.chauffeurId || matchingVoyage.chauffeurId,
      camionId: dech.camionId || matchingVoyage.camionId,
      projetId: dech.projetId || matchingVoyage.projetId,
      userId: matchingVoyage.userId || 1, // OBLIGATOIRE
      poidsClient: undefined as number | undefined,
      poidsDepot: undefined as number | undefined,
      clientId: undefined as number | undefined,
      depotId: undefined as number | undefined
    };

    // Mutuelle exclusivité client/depot basé sur les données du déchargement
    if (dech.clientId && dech.clientId > 0) {
      payload.clientId = dech.clientId;
      payload.depotId = undefined;
      payload.poidsClient = poidsNet;
      payload.poidsDepot = undefined;
    } else if (dech.depotId && dech.depotId > 0) {
      payload.depotId = dech.depotId;
      payload.clientId = undefined;
      payload.poidsDepot = poidsNet;
      payload.poidsClient = undefined;
    } else {
      // Garder les valeurs originales du voyage si le déchargement n'a ni client ni depot
      payload.clientId = matchingVoyage.clientId;
      payload.depotId = matchingVoyage.depotId;
      payload.poidsClient = matchingVoyage.poidsClient;
      payload.poidsDepot = matchingVoyage.poidsDepot;
    }

    // Nettoyage: retirer les clés undefined
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    console.log('📝 Payload voyage synchronisation:', payload);

    this.voyageService.updateVoyage(matchingVoyage.id, payload, 'body').subscribe({
      next: () => {
        console.log('✅ Voyage synchronisé avec succès!');
        console.log('🔄 Rechargement des voyages recommandé');
      },
      error: (err) => {
        console.error('❌ Erreur synchronisation voyage:', err);
        if (err.error instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            console.error('Détails erreur:', reader.result);
          };
          reader.readAsText(err.error);
        }
      }
    });
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

  getActiveFilterLabel(): string {
    if (this.activeFilter === 'all') {
      return 'Tous les bons de chargement';
    } else if (this.activeFilter === 'date' && (this.dateDebut || this.dateFin)) {
      if (this.dateDebut && this.dateFin) {
        const dateD = new Date(this.dateDebut);
        const dateF = new Date(this.dateFin);
        return `Date: ${dateD.toLocaleDateString('fr-FR')} - ${dateF.toLocaleDateString('fr-FR')}`;
      } else if (this.dateDebut) {
        const dateD = new Date(this.dateDebut);
        return `Date: À partir du ${dateD.toLocaleDateString('fr-FR')}`;
      } else if (this.dateFin) {
        const dateF = new Date(this.dateFin);
        return `Date: Jusqu'au ${dateF.toLocaleDateString('fr-FR')}`;
      }
    } else if (this.activeFilter === 'societeP' && this.selectedSocieteP) {
      return `Société: ${this.selectedSocieteP}`;
    }
    return 'Aucun filtre';
  }

  generateFileName(extension: string): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-');
    let filterPart = '';

    // Ajouter le type de filtre au nom du fichier
    if (this.activeFilter === 'date' && (this.dateDebut || this.dateFin)) {
      if (this.dateDebut && this.dateFin) {
        const dateD = new Date(this.dateDebut).toLocaleDateString('fr-FR').replace(/\//g, '-');
        const dateF = new Date(this.dateFin).toLocaleDateString('fr-FR').replace(/\//g, '-');
        filterPart = `_Date_${dateD}_au_${dateF}`;
      } else if (this.dateDebut) {
        const dateD = new Date(this.dateDebut).toLocaleDateString('fr-FR').replace(/\//g, '-');
        filterPart = `_Date_a_partir_${dateD}`;
      } else if (this.dateFin) {
        const dateF = new Date(this.dateFin).toLocaleDateString('fr-FR').replace(/\//g, '-');
        filterPart = `_Date_jusquau_${dateF}`;
      }
    } else if (this.activeFilter === 'societeP' && this.selectedSocieteP) {
      const societeName = this.selectedSocieteP.replace(/[^a-zA-Z0-9]/g, '_');
      filterPart = `_${societeName}`;
    } else {
      filterPart = '_Tous';
    }

    return `BonsChargement${filterPart}_${dateStr}.${extension}`;
  }
}
