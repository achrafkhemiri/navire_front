// ...existing code...
import { Component } from '@angular/core';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { DeclarationControllerService } from '../../api/api/declarationController.service';
import { ProjetDTO } from '../../api/model/projetDTO';
import { DeclarationDTO } from '../../api/model/declarationDTO';
import { ProjetActifService } from '../../service/projet-actif.service';

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
  projets: ProjetDTO[] = [];
  filteredProjets: ProjetDTO[] = [];
  paginatedProjets: ProjetDTO[] = [];
  selectedProjet: ProjetDTO | null = null;
  newProjet: ProjetDTO = { nom: '', nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '', port: '', dateDebut: '', dateFin: '', active: false };
  editMode: boolean = false;
  error: string = '';
  projetActif: ProjetDTO | null = null;
  projetFilter: string = '';
  
  // Déclarations dynamiques pour le formulaire d'ajout/modification
  declarations: Array<{numeroDeclaration: string, quantiteManifestee: number}> = [{numeroDeclaration: '', quantiteManifestee: 0}];
  
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
    private projetActifService: ProjetActifService
  ) {
    this.loadProjets();
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
    // Réinitialiser le formulaire et les déclarations
    this.newProjet = { nom: '', nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '', port: '', dateDebut: '', dateFin: '', active: false };
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
        pr.nom?.toLowerCase().includes(filter) ||
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
            const projetNom = projetAjoute.nom;
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
        
        this.newProjet = { nom: '', nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '', port: '', dateDebut: '', dateFin: '', active: false };
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
    
    // 🔥 IMPORTANT : Sauvegarder le projet sélectionné dans une variable locale
    // car this.selectedProjet sera mis à null avant que le callback async ne termine
    const projetEnCoursDeMiseAJour = { ...this.selectedProjet };
    const projetEstActive = this.selectedProjet.active;
    console.log('🔧 updateProjet() - Projet:', projetEnCoursDeMiseAJour.nom, 'ID:', projetEnCoursDeMiseAJour.id, 'Active:', projetEstActive);
    
    // Si le projet modifié est actif, désactive les autres
    if (projetEstActive) {
      console.log('🔄 Désactivation des autres projets...');
      this.projets.forEach(pr => {
        if (pr.active && pr.id !== projetEnCoursDeMiseAJour.id) {
          pr.active = false;
          console.log('  ❌ Désactivation du projet:', pr.nom, 'ID:', pr.id);
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
    this.projetService.deleteProjet(id, 'body').subscribe({
      next: () => {
        this.projets = this.projets.filter(p => p.id !== id);
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  cancelEdit() {
    this.selectedProjet = null;
    this.editMode = false;
  }
}
