// ...existing code...
import { Component } from '@angular/core';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetDTO } from '../../api/model/projetDTO';

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
  selectedProjet: ProjetDTO | null = null;
  newProjet: ProjetDTO = { nom: '', nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '' };
  editMode: boolean = false;
  error: string = '';

  constructor(private projetService: ProjetControllerService) {
    this.loadProjets();
  }

  openAddProjetModal() {
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
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.projets = json;
            } else {
              this.projets = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.projets = [];
          }
        } else if (Array.isArray(data)) {
          this.projets = data;
        } else {
          this.projets = [];
        }
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  addProjet() {
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
        if (projetAjoute) {
          this.projets.push(projetAjoute);
        }
        this.newProjet = { nom: '', nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '' };
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
    if (!this.selectedProjet?.id) return;
    this.projetService.updateProjet(this.selectedProjet.id, this.selectedProjet, 'body').subscribe({
      next: (updated) => {
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
