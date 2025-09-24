import { Component } from '@angular/core';
import { VoyageControllerService } from '../../api/api/voyageController.service';
import { VoyageDTO } from '../../api/model/voyageDTO';
import { ChauffeurControllerService } from '../../api/api/chauffeurController.service';
import { CamionControllerService } from '../../api/api/camionController.service';
import { ClientControllerService } from '../../api/api/clientController.service';
import { DepotControllerService } from '../../api/api/depotController.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { ChauffeurDTO } from '../../api/model/chauffeurDTO';
import { CamionDTO } from '../../api/model/camionDTO';
import { ClientDTO } from '../../api/model/clientDTO';
import { DepotDTO } from '../../api/model/depotDTO';
import { ProjetDTO } from '../../api/model/projetDTO';

@Component({
  selector: 'app-voyage',
  templateUrl: './voyage.component.html',
  styleUrls: ['./voyage.component.css']
})
export class VoyageComponent {
  voyages: VoyageDTO[] = [];
  selectedVoyage: VoyageDTO | null = null;
  newVoyage: VoyageDTO = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
  editMode: boolean = false;
  error: string = '';
  chauffeurs: ChauffeurDTO[] = [];
  camions: CamionDTO[] = [];
  clients: ClientDTO[] = [];
  depots: DepotDTO[] = [];
  projets: ProjetDTO[] = [];

  constructor(
    private voyageService: VoyageControllerService,
    private chauffeurService: ChauffeurControllerService,
    private camionService: CamionControllerService,
    private clientService: ClientControllerService,
    private depotService: DepotControllerService,
    private projetService: ProjetControllerService
  ) {
    this.loadVoyages();
    this.loadChauffeurs();
    this.loadCamions();
    this.loadClients();
    this.loadDepots();
    this.loadProjets();
  }

  loadChauffeurs() {
    this.chauffeurService.getAllChauffeurs('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.chauffeurs = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing chauffeurs: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.chauffeurs = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement chauffeurs: ' + (err.error?.message || err.message)
    });
  }

  loadCamions() {
    this.camionService.getAllCamions('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.camions = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing camions: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.camions = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement camions: ' + (err.error?.message || err.message)
    });
  }

  loadClients() {
    this.clientService.getAllClients('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.clients = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing clients: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.clients = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement clients: ' + (err.error?.message || err.message)
    });
  }

  loadDepots() {
    this.depotService.getAllDepots('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.depots = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing depots: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.depots = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement depots: ' + (err.error?.message || err.message)
    });
  }

  loadProjets() {
    this.projetService.getAllProjets('body').subscribe({
      next: (data) => {
        if (data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              this.projets = JSON.parse(reader.result as string);
            } catch (e) {
              this.error = 'Erreur parsing projets: ' + e;
            }
          };
          reader.readAsText(data);
        } else {
          this.projets = data;
        }
      },
      error: (err) => this.error = 'Erreur chargement projets: ' + (err.error?.message || err.message)
    });
  }

  loadVoyages() {
      this.voyageService.getAllVoyages('body').subscribe({
        next: (data) => {
          if (data instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                this.voyages = JSON.parse(reader.result as string);
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
            };
            reader.readAsText(data);
          } else {
            this.voyages = data;
          }
        },
        error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
      });
  }

  addVoyage() {
      this.voyageService.createVoyage(this.newVoyage, 'body').subscribe({
        next: (created) => {
          if (created instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const voyage = JSON.parse(reader.result as string);
                this.voyages.push(voyage);
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
            };
            reader.readAsText(created);
          } else {
            this.voyages.push(created);
          }
          this.newVoyage = { numBonLivraison: '', numTicket: '', reste: 0, date: '', poidsClient: 0, poidsDepot: 0 };
        },
        error: (err) => this.error = 'Erreur ajout: ' + (err.error?.message || err.message)
      });
  }

  selectVoyage(vg: VoyageDTO) {
    this.selectedVoyage = { ...vg };
    this.editMode = true;
  }

  updateVoyage() {
    if (!this.selectedVoyage?.id) return;
      this.voyageService.createVoyage(this.selectedVoyage, 'body').subscribe({
        next: (updated: any) => {
          let voyage = updated;
          if (updated instanceof Blob) {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                voyage = JSON.parse(reader.result as string);
                const idx = this.voyages.findIndex((v: VoyageDTO) => v.id === voyage.id);
                if (idx > -1) this.voyages[idx] = voyage;
                this.selectedVoyage = null;
                this.editMode = false;
              } catch (e) {
                this.error = 'Erreur parsing: ' + e;
              }
            };
            reader.readAsText(updated);
          } else {
            const idx = this.voyages.findIndex((v: VoyageDTO) => v.id === voyage.id);
            if (idx > -1) this.voyages[idx] = voyage;
            this.selectedVoyage = null;
            this.editMode = false;
          }
        },
        error: (err) => this.error = 'Erreur modification: ' + (err.error?.message || err.message)
      });
  }

  deleteVoyage(id?: number) {
    if (id === undefined) return;
      this.voyageService.deleteVoyage(id, 'body').subscribe({
        next: (res: any) => {
          this.voyages = this.voyages.filter(v => v.id !== id);
          this.loadVoyages();
        },
        error: (err) => this.error = 'Erreur suppression: ' + (err.error?.message || err.message)
      });
  }

  cancelEdit() {
    this.selectedVoyage = null;
    this.editMode = false;
  }
}
