import { Component } from '@angular/core';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';

@Component({
  selector: 'app-chauffeur',
  templateUrl: './chauffeur.component.html',
  styleUrls: ['./chauffeur.component.css']
})
export class ChauffeurComponent {
  chauffeurs: ChauffeurDTO[] = [];
  filteredChauffeurs: ChauffeurDTO[] = [];
  selectedChauffeur: ChauffeurDTO | null = null;
  newChauffeur: ChauffeurDTO = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
  dialogChauffeur: ChauffeurDTO = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
  editMode: boolean = false;
  showAddDialog: boolean = false;
  isSidebarOpen: boolean = true;
  chauffeurFilter: string = '';
  error: string = '';

  constructor(private chauffeurService: ChauffeurControllerService) {
    this.loadChauffeurs();
  }

  loadChauffeurs() {
    this.chauffeurService.getAllChauffeurs('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.chauffeurs = json;
              this.filteredChauffeurs = [...this.chauffeurs];
            } else {
              this.chauffeurs = [];
              this.filteredChauffeurs = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.chauffeurs = [];
          }
        } else if (Array.isArray(data)) {
          this.chauffeurs = data;
          this.filteredChauffeurs = [...this.chauffeurs];
        } else {
          this.chauffeurs = [];
          this.filteredChauffeurs = [];
        }
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  addChauffeur() {
    const payload = {
      nom: this.newChauffeur.nom,
      numCin: this.newChauffeur.numCin
    };
    this.chauffeurService.createChauffeur(payload as any, 'body').subscribe({
      next: () => {
        this.newChauffeur = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
        this.loadChauffeurs(); // Recharge la liste après ajout
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  selectChauffeur(ch: ChauffeurDTO) {
    this.selectedChauffeur = { ...ch };
    this.editMode = true;
  }

  updateChauffeur() {
    if (!this.selectedChauffeur?.id) return;
    this.chauffeurService.createChauffeur(this.selectedChauffeur, 'body').subscribe({
      next: (updated) => {
        const idx = this.chauffeurs.findIndex(c => c.id === updated.id);
        if (idx > -1) this.chauffeurs[idx] = updated;
        this.selectedChauffeur = null;
        this.editMode = false;
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  deleteChauffeur(id?: number) {
    if (id === undefined) return;
    this.chauffeurService.deleteChauffeur(id, 'body').subscribe({
      next: () => {
        this.chauffeurs = this.chauffeurs.filter(c => c.id !== id);
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  cancelEdit() {
    this.selectedChauffeur = null;
    this.editMode = false;
  }

  filterChauffeurs() {
    if (!this.chauffeurFilter.trim()) {
      this.filteredChauffeurs = [...this.chauffeurs];
    } else {
      const filter = this.chauffeurFilter.toLowerCase();
      this.filteredChauffeurs = this.chauffeurs.filter(ch => 
        ch.nom?.toLowerCase().includes(filter) ||
        ch.numCin?.toLowerCase().includes(filter)
      );
    }
  }

  openAddDialog() {
    this.dialogChauffeur = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
    this.editMode = false;
    this.showAddDialog = true;
  }

  editChauffeur(chauffeur: ChauffeurDTO) {
    this.dialogChauffeur = { ...chauffeur };
    this.editMode = true;
    this.showAddDialog = true;
  }

  saveChauffeur() {
    const payload = {
      nom: this.dialogChauffeur.nom,
      numCin: this.dialogChauffeur.numCin
    };
    this.chauffeurService.createChauffeur(payload as any, 'body').subscribe({
      next: () => {
        this.showAddDialog = false;
        this.loadChauffeurs();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  cancel() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogChauffeur = { nom: '', numCin: '', numBonLivraisonVoyages: new Set<string>() };
  }
}
