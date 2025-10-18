// ...existing code...
import { Component } from '@angular/core';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { DeclarationControllerService } from '../../api/api/declarationController.service';
import { SocieteControllerService } from '../../api/api/societeController.service';
import { ProjetDTO } from '../../api/model/projetDTO';
import { DeclarationDTO } from '../../api/model/declarationDTO';
import { SocieteDTO } from '../../api/model/societeDTO';
import { ProjetActifService } from '../../service/projet-actif.service';
import { firstValueFrom } from 'rxjs';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { ChargementControllerService } from '../../api/api/chargementController.service';

// Interface pour gérer l'état de flip des cartes
interface ProjetDTOWithFlip extends ProjetDTO {
  isFlipped?: boolean;
}

@Component({
  selector: 'app-projet',
  templateUrl: './projet.component.html',
  styleUrls: ['./projet.component.css']
})
export class ProjetComponent {
  openSettingsModal(pr: ProjetDTO) {
    setTimeout(() => {
      const modal = document.getElementById('settingsProjetModal');
      if (modal) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
        if (modalInstance) {
          modalInstance.show();
        }
      }
    }, 0);
  }
  isSidebarOpen: boolean = true;
  openEditProjetModal(pr: ProjetDTO) {
    this.selectedProjet = { ...pr };
    // Pré-remplir les sociétés existantes du projet dans les chips
    const noms = (pr as any)?.societeNoms;
    if (noms) {
      const arr = Array.isArray(noms) ? noms : Array.from(noms as Set<string>);
      this.selectedSocietes = arr.filter((s: string) => !!s && s.trim() !== '');
    } else {
      this.selectedSocietes = [];
    }
    this.editMode = true;
    setTimeout(() => {
      const modal = document.getElementById('editProjetModal');
      if (modal) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
        if (modalInstance) {
          modalInstance.show();
        }
      }
    }, 0);
  }
  projets: ProjetDTOWithFlip[] = [];
  filteredProjets: ProjetDTOWithFlip[] = [];
  paginatedProjets: ProjetDTOWithFlip[] = [];
  selectedProjet: ProjetDTO | null = null;
  newProjet: ProjetDTO = { 
    nomProduit: '', 
    quantiteTotale: 0, 
    nomNavire: '', 
    paysNavire: '', 
    etat: '', 
    port: '', 
    dateDebut: new Date().toISOString().split('T')[0], // Date automatique
    dateFin: '', 
    active: false 
  };
  editMode: boolean = false;
  error: string = '';
  projetActif: ProjetDTO | null = null;
  projetFilter: string = '';
  
  // Gestion des déclarations par projet (pour l'affichage au dos des cartes)
  declarationsByProjet: Map<number, DeclarationDTO[]> = new Map();
  allDeclarations: DeclarationDTO[] = [];
  
  // Déclarations dynamiques pour le formulaire d'ajout/modification
  declarations: Array<{numeroDeclaration: string, quantiteManifestee: number}> = [{numeroDeclaration: '', quantiteManifestee: 0}];
  
  // Gestion des sociétés
  selectedSocietes: string[] = [];
  societeSearchInput: string = '';
  allSocietes: any[] = [];
  filteredSocietes: any[] = [];
  showSocieteDropdown: boolean = false;
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageSizes: number[] = [5, 10, 20, 50];
  
  // Tri
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  Math = Math;

  constructor(
    private projetService: ProjetControllerService,
    private declarationService: DeclarationControllerService,
    private societeService: SocieteControllerService,
    private projetActifService: ProjetActifService,
    private voyageService: VoyageControllerService,
    private chargementService: ChargementControllerService
  ) {
    this.loadProjets();
    this.loadSocietes();
  }

  // Validation helpers
  private isEndAfterStart(start?: string, end?: string): boolean {
    if (!start || !end) return true; // no end date or start means no block
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return e.getTime() > s.getTime();
  }

  // Used by templates to avoid using `new Date()` directly in HTML
  isAddDateInvalid(): boolean {
    const d = this.newProjet;
    return !!(d.dateDebut && d.dateFin) && !this.isEndAfterStart(d.dateDebut, d.dateFin);
  }

  isEditDateInvalid(): boolean {
    const p = this.selectedProjet;
    if (!p) return false;
    return !!(p.dateDebut && p.dateFin) && !this.isEndAfterStart(p.dateDebut, p.dateFin);
  }

  // Charger toutes les sociétés
  loadSocietes(): void {
    this.societeService.getAllSocietes('body').subscribe({
      next: (data) => {
        this.allSocietes = data;
      },
      error: (err) => {
        console.error('Erreur chargement sociétés:', err);
      }
    });
  }

  // Méthodes pour gérer les déclarations dynamiques
  ajouterDeclaration(): void {
    this.declarations.push({numeroDeclaration: '', quantiteManifestee: 0});
  }

  supprimerDeclaration(index: number): void {
    if (this.declarations.length > 1) {
      this.declarations.splice(index, 1);
    }
  }

  resetDeclarations(): void {
    this.declarations = [{numeroDeclaration: '', quantiteManifestee: 0}];
  }

  openAddProjetModal() {
    // Obtenir la date actuelle au format YYYY-MM-DD
    const today = new Date();
    const dateDebut = today.toISOString().split('T')[0];
    
    // Réinitialiser le formulaire avec la date de début automatique
    this.newProjet = { 
      nomProduit: '', 
      quantiteTotale: 0, 
      nomNavire: '', 
      paysNavire: '', 
      etat: '', 
      port: '', 
      dateDebut: dateDebut,  // Date automatique
      dateFin: '', 
      active: false 
    };
    this.resetDeclarations();
    
    setTimeout(() => {
      const modal = document.getElementById('addProjetModal');
      if (modal) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
        if (modalInstance) {
          modalInstance.show();
        }
      }
    }, 0);
  }

  loadProjets() {
    this.projetService.getAllProjets('body').subscribe({
      next: async (data) => {
        let projets: ProjetDTO[] = [];
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              projets = json;
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
          }
        } else if (Array.isArray(data)) {
          projets = data;
        }
        this.projets = projets;
        // Sélectionne automatiquement le projet actif
        this.projetActif = this.projets.find(pr => pr.active) || null;
        
        // Charger toutes les déclarations pour l'affichage au dos des cartes
        this.loadAllDeclarations();
        
        this.applyFilter(); // applyFilter appelle sortProjetsByDateAndActive
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }
  
  applyFilter() {
    const filter = this.projetFilter.trim().toLowerCase();
    if (!filter) {
      this.filteredProjets = [...this.projets];
    } else {
      this.filteredProjets = this.projets.filter(pr =>
        pr.nomProduit?.toLowerCase().includes(filter) ||
        pr.nomNavire?.toLowerCase().includes(filter)
      );
    }
    this.sortProjetsByDateAndActive();
    this.updatePagination();
  }
  
  sortProjetsByDateAndActive() {
    // Trier les projets par ID décroissant (le plus récent en premier)
    this.filteredProjets.sort((a, b) => {
      // Le projet actif est toujours en première position
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      
      // Sinon, trier par ID décroissant (le plus récent en premier)
      const idA = a.id || 0;
      const idB = b.id || 0;
      return idB - idA;
    });
  }
  
  sortBy(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortProjets();
  }
  
  sortProjets() {
    if (!this.sortColumn) {
      this.updatePagination();
      return;
    }
    
    this.filteredProjets.sort((a, b) => {
      let aVal: any = a[this.sortColumn as keyof ProjetDTO];
      let bVal: any = b[this.sortColumn as keyof ProjetDTO];
      
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    this.updatePagination();
  }
  
  updatePagination() {
    this.totalPages = Math.ceil(this.filteredProjets.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedProjets = this.filteredProjets.slice(startIndex, endIndex);
  }
  
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }
  
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }
  
  onPageSizeChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  addProjet() {
    // Validate dates: dateFin > dateDebut when provided
    if (!this.isEndAfterStart(this.newProjet.dateDebut, this.newProjet.dateFin)) {
      this.error = 'La date de fin doit être strictement supérieure à la date de début.';
      return;
    }
    const projetEstActive = this.newProjet.active;
    
    // Si le projet ajouté est actif, désactive les autres
    if (projetEstActive) {
      this.projets.forEach(pr => {
        if (pr.active) {
          pr.active = false;
          if (pr.id) {
            this.projetService.updateProjet(pr.id, pr, 'body').subscribe();
          }
        }
      });
    }
    
    this.projetService.createProjet(this.newProjet, 'body').subscribe({
      next: async (created) => {
        let projetAjoute: ProjetDTO | undefined = created;
        if (created instanceof Blob) {
          const text = await created.text();
          try {
            projetAjoute = JSON.parse(text);
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            projetAjoute = undefined;
          }
        }
        
        if (projetAjoute && projetAjoute.id) {
          this.projets.push(projetAjoute);
          
          // Créer les déclarations associées au projet
          const declarationsValides = this.declarations.filter(d => d.numeroDeclaration && d.numeroDeclaration.trim() !== '');
          if (declarationsValides.length > 0) {
            const projetId = projetAjoute.id;
            const projetNom = projetAjoute.nomProduit;
            declarationsValides.forEach(decl => {
              const declarationDTO: DeclarationDTO = {
                numeroDeclaration: decl.numeroDeclaration,
                quantiteManifestee: decl.quantiteManifestee,
                projetId: projetId
              };
              this.declarationService.createDeclaration(declarationDTO).subscribe({
                next: () => console.log(`✅ Déclaration ${decl.numeroDeclaration} créée pour le projet ${projetNom}`),
                error: (err) => console.error('❌ Erreur création déclaration:', err)
              });
            });
          }
          
          // Si le projet ajouté est actif, mettre à jour le service
          if (projetEstActive) {
            this.projetActifService.setProjetActif(projetAjoute);
            console.log('✅ Nouveau projet actif défini:', projetAjoute);
          }
        }
        
        this.newProjet = { nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '', port: '', dateDebut: '', dateFin: '', active: false };
        this.resetDeclarations();
        this.loadProjets(); // Recharge la liste pour garantir la cohérence
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  selectProjet(pr: ProjetDTO) {
    this.selectedProjet = { ...pr };
    this.editMode = true;
  }

  updateProjet() {
    if (!this.selectedProjet || !this.selectedProjet.id) return;
    // Validate dates for edit
    if (!this.isEndAfterStart(this.selectedProjet.dateDebut, this.selectedProjet.dateFin)) {
      this.error = 'La date de fin doit être strictement supérieure à la date de début.';
      return;
    }
    
    // 🔥 IMPORTANT : Sauvegarder le projet sélectionné dans une variable locale
    // car this.selectedProjet sera mis à null avant que le callback async ne termine
    const projetEnCoursDeMiseAJour = { ...this.selectedProjet };
    const projetEstActive = this.selectedProjet.active;
    console.log('🔧 updateProjet() - Projet:', projetEnCoursDeMiseAJour.nomProduit, 'ID:', projetEnCoursDeMiseAJour.id, 'Active:', projetEstActive);
    
    // Si le projet modifié est actif, désactive les autres
    if (projetEstActive) {
      console.log('🔄 Désactivation des autres projets...');
      this.projets.forEach(pr => {
        if (pr.active && pr.id !== projetEnCoursDeMiseAJour.id) {
          pr.active = false;
          console.log('  ❌ Désactivation du projet:', pr.nomProduit, 'ID:', pr.id);
          if (pr.id) {
            this.projetService.updateProjet(pr.id, pr, 'body').subscribe();
          }
        }
      });
    }
    
    this.projetService.updateProjet(projetEnCoursDeMiseAJour.id!, projetEnCoursDeMiseAJour, 'body').subscribe({
      next: async (updated) => {
        console.log('✅ Projet mis à jour:', updated);
        console.log('🔍 projetEstActive:', projetEstActive, 'projetEnCoursDeMiseAJour:', projetEnCoursDeMiseAJour);
        
        // Si le projet est activé, mettre à jour le service ProjetActifService
        if (projetEstActive && projetEnCoursDeMiseAJour) {
          console.log('🔄 Traitement du projet actif...');
          let projetUpdated: any = updated;
          
          // Gérer le cas où updated est un Blob
          if (updated instanceof Blob) {
            console.log('📦 Blob détecté, parsing...');
            const text = await updated.text();
            console.log('📄 Texte brut du Blob:', text);
            try {
              projetUpdated = JSON.parse(text);
              console.log('✅ Projet parsé:', projetUpdated);
            } catch (e) {
              console.error('❌ Erreur parsing projet:', e);
              projetUpdated = projetEnCoursDeMiseAJour;
            }
          } else {
            console.log('✅ Pas de Blob, projet déjà en objet');
          }
          
          console.log('🔥 Appel setProjetActif avec:', projetUpdated);
          
          // 🔥 IMPORTANT : Nettoyer le sessionStorage pour éviter les conflits
          window.sessionStorage.removeItem('projetActifId');
          
          // Mettre à jour le service avec le projet complet
          this.projetActifService.setProjetActif(projetUpdated);
          console.log('✅ Projet actif mis à jour:', projetUpdated);
          
          // 🔥 Forcer une seconde émission après un court délai pour s'assurer que tous les composants reçoivent la notification
          setTimeout(() => {
            this.projetActifService.setProjetActif(projetUpdated);
            console.log('🔄 Émission forcée du projet actif');
          }, 100);
        } else {
          console.warn('⚠️ Projet non activé ou selectedProjet null - pas de mise à jour du service');
        }
        
        this.loadProjets();
        this.selectedProjet = null;
        this.editMode = false;
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }


  closeAddProjetModal() {
    const modal = document.getElementById('addProjetModal');
    if (modal) {
      const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
      if (modalInstance) {
        modalInstance.hide();
      }
    }
  }

  closeEditProjetModal() {
    const modal = document.getElementById('editProjetModal');
    if (modal) {
      const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
      if (modalInstance) {
        modalInstance.hide();
      }
    }
    this.selectedProjet = null;
    this.editMode = false;
  }

  deleteProjet(id?: number) {
    if (id === undefined) return;
    const projet = this.projets.find(p => p.id === id);
    const nom = projet?.nomProduit || `Projet ${id}`;
    // Vérifier s'il y a des voyages/chargements liés
    Promise.all([
      firstValueFrom(this.voyageService.getVoyagesByProjet(id!, 'body')).catch(() => []),
      firstValueFrom(this.chargementService.getChargementsByProjet(id!)).catch(() => [])
    ]).then(([voyages, chargements]: any[]) => {
      const hasLinks = Array.isArray(voyages) && voyages.length > 0 || Array.isArray(chargements) && chargements.length > 0;
      if (hasLinks) {
        this.error = `Impossible de supprimer « ${nom} ». Le projet contient des voyages ou des chargements.`;
        return;
      }
      this.projetService.deleteProjet(id!, 'body').subscribe({
        next: () => {
          this.projets = this.projets.filter(p => p.id !== id);
          // Rafraîchir la liste affichée (filtres + pagination)
          this.applyFilter();
          this.error = '';
          // Fermer le modal de confirmation s'il est ouvert
          const modalEl = document.getElementById('deleteConfirmModal');
          const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl);
          modalInstance?.hide();
          this.selectedProjet = null;
        },
        error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
      });
    });
  }

  cancelEdit() {
    this.selectedProjet = null;
    this.editMode = false;
  }

  // Méthode pour basculer l'état de flip d'une carte
  toggleCardFlip(projet: ProjetDTOWithFlip): void {
    projet.isFlipped = !projet.isFlipped;
  }

  // Charge toutes les déclarations et les groupe par projetId
  loadAllDeclarations(): void {
    console.log('🔄 Chargement des déclarations...');
    this.declarationService.getAllDeclarations().subscribe({
      next: async (data) => {
        console.log('✅ Déclarations reçues (raw):', data);
        console.log('✅ Type de data:', typeof data, 'isArray:', Array.isArray(data));
        
        // Gérer le cas où data est un Blob
        let declarations: DeclarationDTO[] = [];
        if (data instanceof Blob) {
          const text = await data.text();
          console.log('📄 Blob text:', text);
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              declarations = json;
            }
          } catch (e) {
            console.error('❌ Erreur parsing JSON:', e);
            return;
          }
        } else if (Array.isArray(data)) {
          declarations = data;
        } else {
          console.error('❌ Type de données inattendu:', data);
          return;
        }
        
        console.log('✅ Déclarations parsées:', declarations);
        this.allDeclarations = declarations;
        
        if (declarations.length === 0) {
          console.warn('⚠️ Aucune déclaration trouvée en base de données.');
          console.info('💡 Pour ajouter des déclarations de test, exécutez le script SQL : navire/insert_test_declarations.sql');
          console.info('💡 Ou créez un nouveau projet avec des déclarations via le formulaire.');
        }
        
        // Grouper les déclarations par projetId
        this.declarationsByProjet.clear();
        declarations.forEach((decl, index) => {
          console.log(`  📄 Déclaration ${index + 1}:`, {
            id: decl.id,
            numero: decl.numeroDeclaration,
            quantite: decl.quantiteManifestee,
            projetId: decl.projetId,
            projetIdType: typeof decl.projetId
          });
          if (decl.projetId !== undefined && decl.projetId !== null) {
            // Convertir en number pour être sûr
            const pid = Number(decl.projetId);
            if (!this.declarationsByProjet.has(pid)) {
              this.declarationsByProjet.set(pid, []);
            }
            this.declarationsByProjet.get(pid)?.push(decl);
          }
        });
        console.log('📊 Déclarations par projet:', this.declarationsByProjet);
        console.log('📊 Map keys:', Array.from(this.declarationsByProjet.keys()));
      },
      error: (err) => {
        console.error('❌ Erreur chargement déclarations:', err);
      }
    });
  }

  // Récupère les déclarations pour un projet spécifique
  getDeclarationsForProjet(projetId?: number): DeclarationDTO[] {
    if (projetId === undefined) return [];
    const declarations = this.declarationsByProjet.get(projetId) || [];
    console.log(`📄 Déclarations pour projet ${projetId}:`, declarations);
    return declarations;
  }

  // Méthodes pour la gestion des sociétés
  onSocieteSearchInput(): void {
    const search = this.societeSearchInput.trim().toLowerCase();
    if (search) {
      this.filteredSocietes = this.allSocietes.filter(s =>
        s.nom.toLowerCase().includes(search)
      );
      this.showSocieteDropdown = true;
    } else {
      this.filteredSocietes = [];
      this.showSocieteDropdown = false;
    }
  }

  selectSociete(societe: any): void {
    if (!this.selectedSocietes.includes(societe.nom)) {
      this.selectedSocietes.push(societe.nom);
    }
    this.societeSearchInput = '';
    this.filteredSocietes = [];
    this.showSocieteDropdown = false;
  }

  removeSociete(societe: string): void {
    this.selectedSocietes = this.selectedSocietes.filter(s => s !== societe);
  }

  addSocieteFromSearch(): void {
    const nom = this.societeSearchInput.trim();
    if (nom && !this.selectedSocietes.includes(nom)) {
      this.selectedSocietes.push(nom);
    }
    this.societeSearchInput = '';
    this.filteredSocietes = [];
    this.showSocieteDropdown = false;
  }

  // Méthode pour ouvrir le modal de confirmation de suppression
  openDeleteConfirmModal(projet: ProjetDTO): void {
    this.selectedProjet = projet;
    setTimeout(() => {
      const modal = document.getElementById('deleteConfirmModal');
      if (modal) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modal);
        if (modalInstance) {
          modalInstance.show();
        }
      }
    }, 0);
  }
}
