import { Component } from '@angular/core';
import { DepotControllerService } from '../../api/api/depotController.service';
import { DepotDTO } from '../../api/model/depotDTO';

@Component({
  selector: 'app-depot',
  templateUrl: './depot.component.html',
  styleUrls: ['./depot.component.css']
})
export class DepotComponent {
  depots: DepotDTO[] = [];
  filteredDepots: DepotDTO[] = [];
  selectedDepot: DepotDTO | null = null;
  dialogDepot: DepotDTO = { nom: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  depotFilter: string = '';

  constructor(private depotService: DepotControllerService) {
    this.loadDepots();
  }

  openAddDialog() {
    this.dialogDepot = { nom: '' };
    this.showAddDialog = true;
    this.editMode = false;
  }

  selectDepot(dep: DepotDTO) {
    this.dialogDepot = { ...dep };
    this.selectedDepot = dep;
    this.editMode = true;
    this.showAddDialog = false;
  }

  addDialogDepot() {
    if (!this.dialogDepot.nom) {
      this.error = 'Veuillez remplir le nom.';
      return;
    }
    this.depotService.createDepot(this.dialogDepot, 'body').subscribe({
      next: () => {
        this.dialogDepot = { nom: '' };
        this.loadDepots();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
    });
  }

  updateDialogDepot() {
    if (!this.dialogDepot?.id) return;
    this.depotService.createDepot(this.dialogDepot, 'body').subscribe({
      next: () => {
        this.dialogDepot = { nom: '' };
        this.selectedDepot = null;
        this.editMode = false;
        this.loadDepots();
        this.closeDialog();
      },
      error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
    });
  }

  closeDialog() {
    this.showAddDialog = false;
    this.editMode = false;
    this.dialogDepot = { nom: '' };
    this.selectedDepot = null;
    this.error = '';
  }

  applyFilter() {
    const filter = this.depotFilter.trim().toLowerCase();
    if (!filter) {
      this.filteredDepots = this.depots;
    } else {
      this.filteredDepots = this.depots.filter(d =>
        d.nom?.toLowerCase().includes(filter)
      );
    }
  }

  deleteDepot(id?: number) {
    if (id === undefined) return;
    this.depotService.deleteDepot(id, 'body').subscribe({
      next: () => {
        this.loadDepots();
      },
      error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
    });
  }

  loadDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: async (data) => {
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
              this.depots = json;
            } else {
              this.depots = [];
            }
          } catch (e) {
            this.error = 'Erreur parsing JSON: ' + e;
            this.depots = [];
          }
        } else if (Array.isArray(data)) {
          this.depots = data;
        } else {
          this.depots = [];
        }
        this.applyFilter();
      },
      error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
    });
  }
}
