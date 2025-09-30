import { Component } from '@angular/core';
import { DepotControllerService } from '../../api/api/depotController.service';
import { HttpClient } from '@angular/common/http';
import { Inject } from '@angular/core';
import { BASE_PATH } from '../../api/variables';
import { ProjetActifService } from '../../service/projet-actif.service';
import { ProjetControllerService } from '../../api/api/projetController.service';
import { DepotDTO } from '../../api/model/depotDTO';

@Component({
  selector: 'app-depot',
  templateUrl: './depot.component.html',
  styleUrls: ['./depot.component.css']
})
export class DepotComponent {
  depots: DepotDTO[] = [];
  filteredDepots: DepotDTO[] = [];
  projetActifId: number | null = null;
  selectedDepot: DepotDTO | null = null;
  dialogDepot: DepotDTO = { nom: '' };
  editMode: boolean = false;
  error: string = '';
  isSidebarOpen: boolean = true;
  showAddDialog: boolean = false;
  depotFilter: string = '';

  constructor(private depotService: DepotControllerService, private projetActifService: ProjetActifService, private projetService: ProjetControllerService, private http: HttpClient, @Inject(BASE_PATH) private basePath: string) {
    this.loadProjetActif();
  }

  loadProjetActif() {
    // Récupère le projet actif depuis le service (préféré) ou localStorage
    const projet = this.projetActifService.getProjetActif?.();
    if (projet && projet.id) {
      this.projetActifId = projet.id;
    } else {
      const projetActif = window.sessionStorage.getItem('projetActifId');
      if (projetActif) {
        this.projetActifId = Number(projetActif);
      }
    }
    console.log('loadProjetActif() - projetActifId:', this.projetActifId);
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
    // Associe le projet actif
    if (this.projetActifId) {
      this.dialogDepot.projetId = this.projetActifId;
    }

    // Log request payload
  console.log('Création depot - payload:', this.dialogDepot);

    this.depotService.createDepot(this.dialogDepot, 'body').subscribe({
      next: (created) => {
  // Log raw response
  console.log('Réponse création depot (raw):', created);

        // If backend returns Blob, parse it to extract created depot and id
        if (created instanceof Blob) {
          created.text().then(text => {
            try {
              const parsed = JSON.parse(text);
              console.log('Réponse création depot (parsed):', parsed);
              const parsedId = parsed?.id;
              console.log('Parsed created depot id from Blob:', parsedId);
              if (this.projetActifId && parsedId) {
                this.projetService.addDepotToProjet(this.projetActifId, parsedId).subscribe({
                  next: () => console.log('Depot associé au projet actif (via Blob)'),
                  error: (err) => console.error('Erreur association depot-projet (via Blob):', err)
                });
              }
            } catch (e) {
              console.error('Erreur parsing création depot:', e);
            }
          }).catch(e => console.error('Erreur lecture Blob création depot:', e));
        } else {
          console.log('Depot créé:', created);
        }

        this.dialogDepot = { nom: '' };
        // Auto-associate with active project if available
        let createdId: number | undefined;
        if (created && !(created instanceof Blob)) {
          createdId = (created as any).id;
        }
        if (this.projetActifId && createdId) {
          this.projetService.addDepotToProjet(this.projetActifId, createdId).subscribe({
            next: () => console.log('Depot associé au projet actif'),
            error: (err) => console.error('Erreur association depot-projet:', err)
          });
        }
        this.loadDepots();
        this.closeDialog();
      },
      error: (err) => {
        this.error = 'Erreur ajout: ' + (err.error?.message || err.message);
        console.error('Erreur création depot:', err);
      }
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
    let depotsFiltrés = this.depots;
    // Filtre par projet actif
    if (this.projetActifId) {
      // If depots were returned from the project-scoped endpoint they may not include projetId
      depotsFiltrés = depotsFiltrés.filter(d => (d.projetId === undefined) || (d.projetId === this.projetActifId));
    }
    // Filtre par texte
    if (filter) {
      depotsFiltrés = depotsFiltrés.filter(d =>
        d.nom?.toLowerCase().includes(filter)
      );
    }
    this.filteredDepots = depotsFiltrés;
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
    console.log('loadDepots() - projetActifId:', this.projetActifId);
    if (this.projetActifId) {
      // Prefer server endpoint that returns depots for a project
      const url = `${this.basePath}/api/projets/${this.projetActifId}/depots`;
      this.http.get<any[]>(url, { withCredentials: true, responseType: 'json' as 'json' }).subscribe({
        next: (data) => {
          console.log('loadDepots() - project-scoped response:', data);
          if (Array.isArray(data)) {
            this.depots = data;
          } else {
            this.depots = [];
          }
          this.applyFilter();
        },
        error: err => {
          console.warn('Project-scoped depot request failed, falling back to getAllDepots', err);
          // fallback to existing getAllDepots behavior
          this.depotService.getAllDepots('body').subscribe({
            next: async (data) => {
              console.log('loadDepots() - raw response:', data);
              if (data instanceof Blob) {
                const text = await data.text();
                console.log('loadDepots() - blob text:', text);
                try {
                  const json = JSON.parse(text);
                  console.log('loadDepots() - parsed json:', json);
                  if (Array.isArray(json)) {
                    this.depots = json;
                  } else {
                    this.depots = [];
                  }
                } catch (e) {
                  this.error = 'Erreur parsing JSON: ' + e;
                  console.error('Erreur parsing JSON in loadDepots:', e);
                  this.depots = [];
                }
              } else if (Array.isArray(data)) {
                console.log('loadDepots() - json array, length:', data.length);
                this.depots = data;
              } else {
                console.log('loadDepots() - unexpected response:', data);
                this.depots = [];
              }
              this.applyFilter();
            },
            error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
          });
        }
      });
    } else {
      // If no active project, fetch all depots
      this.depotService.getAllDepots('body').subscribe({
        next: async (data) => {
          console.log('loadDepots() - raw response:', data);
          if (data instanceof Blob) {
            const text = await data.text();
            console.log('loadDepots() - blob text:', text);
            try {
              const json = JSON.parse(text);
              console.log('loadDepots() - parsed json:', json);
              if (Array.isArray(json)) {
                this.depots = json;
              } else {
                this.depots = [];
              }
            } catch (e) {
              this.error = 'Erreur parsing JSON: ' + e;
              console.error('Erreur parsing JSON in loadDepots:', e);
              this.depots = [];
            }
          } else if (Array.isArray(data)) {
            console.log('loadDepots() - json array, length:', data.length);
            this.depots = data;
          } else {
            console.log('loadDepots() - unexpected response:', data);
            this.depots = [];
          }
          this.applyFilter();
        },
        error: (err) => this.error = 'Erreur chargement: ' + (err.error?.message || err.message)
      });
    }
  }
}
