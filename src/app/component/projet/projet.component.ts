import { Component } from '@angular/core';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ProjetDTO } from '../../api/model/projetDTO';

@Component({
  selector: 'app-projet',
  templateUrl: './projet.component.html',
  styleUrls: ['./projet.component.css']
})
export class ProjetComponent {
  projets: ProjetDTO[] = [];
  selectedProjet: ProjetDTO | null = null;
  newProjet: ProjetDTO = { nom: '', nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '' };
  editMode: boolean = false;
  error: string = '';

  constructor(private projetService: ProjetControllerService) {
    this.loadProjets();
  }

  loadProjets() {
    this.projetService.getAllProjets('body').subscribe({
      next: (data) => this.projets = data,
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }

  addProjet() {
    this.projetService.createProjet(this.newProjet, 'body').subscribe({
      next: (created) => {
        this.projets.push(created);
        this.newProjet = { nom: '', nomProduit: '', quantiteTotale: 0, nomNavire: '', paysNavire: '', etat: '' };
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
    this.projetService.createProjet(this.selectedProjet, 'body').subscribe({
      next: (updated) => {
        const idx = this.projets.findIndex(p => p.id === updated.id);
        if (idx > -1) this.projets[idx] = updated;
        this.selectedProjet = null;
        this.editMode = false;
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
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
